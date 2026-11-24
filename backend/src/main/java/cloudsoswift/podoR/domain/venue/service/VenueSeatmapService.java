package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.cancel.CancellationService;
import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.venue.dto.SeatmapCancelPreview;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest.SeatItem;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapResponse;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.entity.VenueLayout;
import cloudsoswift.podoR.domain.venue.repository.VenueLayoutRepository;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 섹션 배치(layout)와 좌석 목록을 한 트랜잭션으로 등록한다.
 * - layout: VenueLayout 1:1 upsert
 * - seats: 기존 좌석과 (section_key, row_number, seat_number) 로 diff 한다.
 *   같은 좌석은 행(seq)을 유지해 회차 좌석·예매 연결을 지킨다.
 *   사라지거나 사용 안 함이 된 좌석의 회차 좌석은 지우고, 그 좌석의 예매는 관리자 확인 후 부분 취소한다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class VenueSeatmapService {

    private final VenueRepository venueRepository;
    private final VenueLayoutRepository venueLayoutRepository;
    private final SeatRepository seatRepository;
    private final EventSeatRepository eventSeatRepository;
    private final TicketingItemRepository ticketingItemRepository;
    private final SeatViewSnapshotCache seatViewSnapshotCache;
    private final CancellationService cancellationService;

    /** 좌석 정체성. */
    record SeatLocation(String sectionKey, String rowNumber, Integer seatNumber) {
        static SeatLocation of(SeatItem i) {
            return new SeatLocation(i.getSectionKey(), i.getRowNumber(), i.getSeatNumber());
        }
    }

    @Transactional
    public VenueSeatmapResponse register(Long venueSeq, VenueSeatmapRequest request) {
        Venue venue = venueRepository.findById(venueSeq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + venueSeq));
        List<SeatItem> items = request.getSeats() != null ? request.getSeats() : List.of();

        // 0) 요청 검사
        validate(items);

        // 1) 분류: 유지 / 추가 / 제거 / 사용 안 함 전환.
        //    section_key 가 없는 기존 좌석(컬럼 추가 전 데이터)은 섹션 이름으로 키를 찾는다.
        //    이름이 대응되지 않으면 "사라진 좌석"이 된다.
        List<Seat> existing = seatRepository.findByVenueSeq(venueSeq);
        Map<String, String> keyByName = new HashMap<>();
        for (SeatItem item : items) keyByName.putIfAbsent(item.getSection(), item.getSectionKey());
        Map<Seat, String> backfill = new HashMap<>();
        Map<SeatLocation, Seat> existingByLocation = new HashMap<>();
        List<Seat> removed = new ArrayList<>();
        for (Seat seat : existing) {
            String key = seat.getSectionKey();
            if (key == null && (key = keyByName.get(seat.getSection())) != null) backfill.put(seat, key);
            if (key == null) removed.add(seat);
            else existingByLocation.put(new SeatLocation(key, seat.getRowNumber(), seat.getSeatNumber()), seat);
        }
        Map<SeatLocation, SeatItem> requested = new LinkedHashMap<>();
        for (SeatItem item : items) requested.put(SeatLocation.of(item), item);
        for (Map.Entry<SeatLocation, Seat> e : existingByLocation.entrySet()) {
            if (!requested.containsKey(e.getKey())) removed.add(e.getValue());
        }
        List<Seat> turnedOff = new ArrayList<>();
        List<SeatItem> added = new ArrayList<>();
        for (Map.Entry<SeatLocation, SeatItem> e : requested.entrySet()) {
            Seat seat = existingByLocation.get(e.getKey());
            if (seat == null) {
                added.add(e.getValue());
            } else if (seat.getIsAvailable() && !isAvailable(e.getValue())) {
                turnedOff.add(seat);
            }
        }

        // 2) 사라지거나 사용 안 함이 된 좌석의 회차 좌석 정리 계획. 확인이 필요하면 여기서 409(아무것도 안 바꿈).
        List<Seat> retired = new ArrayList<>(removed);
        retired.addAll(turnedOff);
        EventSeatCleanup cleanup = planCleanup(retired);
        cleanup.requireConfirmation(request.getConfirmedCancelSeatCount());

        // 3) 레이아웃 upsert
        boolean layoutSaved = false;
        if (request.getLayoutJson() != null) {
            venueLayoutRepository.findByVenueSeq(venueSeq)
                    .ifPresentOrElse(
                            layout -> layout.update(request.getLayoutJson()),
                            () -> venueLayoutRepository.save(VenueLayout.builder()
                                    .venue(venue)
                                    .layoutJson(request.getLayoutJson())
                                    .build())
                    );
            layoutSaved = true;
        }

        // 4) 예매 부분 취소 → 항목 연결 끊기 → 회차 좌석 삭제
        cleanup.apply();

        // 5) 제거 좌석 삭제 → 유지 좌석 갱신 → 새 좌석 저장
        if (!removed.isEmpty()) {
            seatRepository.deleteAllByIdInBatch(removed.stream().map(Seat::getSeq).toList());
        }
        backfill.forEach(Seat::assignSectionKey);
        for (Map.Entry<SeatLocation, SeatItem> e : requested.entrySet()) {
            Seat seat = existingByLocation.get(e.getKey());
            if (seat == null) continue;
            if (!seat.getSection().equals(e.getValue().getSection())) seat.rename(e.getValue().getSection());
            seat.changeAvailability(isAvailable(e.getValue()));
        }
        List<Seat> newSeats = new ArrayList<>();
        for (SeatItem item : added) {
            newSeats.add(Seat.builder()
                    .venue(venue)
                    .section(item.getSection())
                    .sectionKey(item.getSectionKey())
                    .rowNumber(item.getRowNumber())
                    .seatNumber(item.getSeatNumber())
                    .isAvailable(isAvailable(item))
                    .build());
        }
        seatRepository.saveAll(newSeats);

        return new VenueSeatmapResponse(venueSeq, layoutSaved, requested.size());
    }

    private static boolean isAvailable(SeatItem item) {
        return item.getIsAvailable() == null || item.getIsAvailable();
    }

    private static void validate(List<SeatItem> items) {
        for (SeatItem item : items) {
            if (item.getSectionKey() == null || item.getSectionKey().isBlank()) {
                throw new IllegalArgumentException("섹션 키(sectionKey)가 없는 좌석이 있습니다: " + item.getSection());
            }
        }
        // 좌석 키 중복 — 같은 섹션에 같은 (줄, 번호)가 두 번 들어오면 uk_seat_location 을 위반한다.
        Set<SeatLocation> seen = new HashSet<>();
        Set<String> duplicatedSections = new LinkedHashSet<>();
        for (SeatItem item : items) {
            if (!seen.add(SeatLocation.of(item))) duplicatedSections.add(item.getSection());
        }
        if (!duplicatedSections.isEmpty()) {
            throw new IllegalArgumentException(
                    "같은 좌석(줄·번호)이 중복되었습니다: " + String.join(", ", duplicatedSections));
        }
        // 섹션 이름 중복 — 좌석 플랜·예매 좌석맵은 섹션 이름으로 좌석을 매칭하므로,
        // 서로 다른 섹션이 같은 이름이면 구분할 수 없다.
        Map<String, String> keyByName = new HashMap<>();
        Set<String> duplicatedNames = new LinkedHashSet<>();
        for (SeatItem item : items) {
            String prev = keyByName.putIfAbsent(item.getSection(), item.getSectionKey());
            if (prev != null && !prev.equals(item.getSectionKey())) duplicatedNames.add(item.getSection());
        }
        if (!duplicatedNames.isEmpty()) {
            throw new IllegalArgumentException(
                    "섹션 이름이 중복되었습니다: " + String.join(", ", duplicatedNames)
                            + ". 각 섹션의 이름을 서로 다르게 지정해 주세요.");
        }
    }

    private EventSeatCleanup planCleanup(List<Seat> retired) {
        if (retired.isEmpty()) return new EventSeatCleanup(List.of(), List.of());
        List<EventSeat> eventSeats = eventSeatRepository.findAllBySeatSeqIn(
                retired.stream().map(Seat::getSeq).toList());
        List<TicketingItem> items = eventSeats.isEmpty() ? List.of()
                : ticketingItemRepository.findAllByEventSeatSeqIn(eventSeats.stream().map(EventSeat::getSeq).toList());
        return new EventSeatCleanup(eventSeats, items);
    }

    /**
     * 사라지거나 사용 안 함이 된 좌석의 회차 좌석 정리.
     * - 지나지 않은 회차의 활성 항목은 그 좌석만 부분 취소한다(관리자 확인 필요).
     * - 지난 회차의 예매는 취소하지 않는다.
     * - 그 회차 좌석을 참조하는 모든 항목의 연결을 끊고(좌석 정보는 스냅샷으로 남음) 회차 좌석을 지운다.
     */
    private final class EventSeatCleanup {
        private final List<EventSeat> eventSeats;
        private final List<TicketingItem> items;
        private final LocalDateTime now = LocalDateTime.now();
        private final List<TicketingItem> toCancel;

        EventSeatCleanup(List<EventSeat> eventSeats, List<TicketingItem> items) {
            this.eventSeats = eventSeats;
            this.items = items;
            this.toCancel = items.stream()
                    .filter(TicketingItem::isActive)
                    .filter(i -> i.getTicketingOrder().isCancellable()) // PAID/부분 취소 주문만(그 밖은 연결만 끊는다)
                    .filter(i -> !i.getTicketingOrder().getEvent().getEventDate().isBefore(now))
                    .toList();
        }

        /** 취소할 좌석이 있는데 관리자가 확인한 수와 다르면 409. */
        void requireConfirmation(Integer confirmed) {
            if (toCancel.isEmpty() || Integer.valueOf(toCancel.size()).equals(confirmed)) return;
            Map<Event, List<TicketingItem>> byEvent = new LinkedHashMap<>();
            for (TicketingItem i : toCancel) {
                byEvent.computeIfAbsent(i.getTicketingOrder().getEvent(), k -> new ArrayList<>()).add(i);
            }
            List<SeatmapCancelPreview.EventItem> events = new ArrayList<>();
            byEvent.forEach((e, list) -> events.add(new SeatmapCancelPreview.EventItem(
                    e.getEventId(), e.getTitle(), e.getEventDate(), list.size())));
            long orders = toCancel.stream().map(TicketingItem::getTicketingOrder).distinct().count();
            throw new SeatmapCancelConfirmRequiredException(
                    new SeatmapCancelPreview(toCancel.size(), (int) orders, events));
        }

        void apply() {
            if (eventSeats.isEmpty()) return;
            Map<TicketingOrder, List<TicketingItem>> byOrder = new LinkedHashMap<>();
            for (TicketingItem i : toCancel) {
                byOrder.computeIfAbsent(i.getTicketingOrder(), k -> new ArrayList<>()).add(i);
            }
            byOrder.forEach((order, list) ->
                    cancellationService.cancel(order, list, CancelReason.VENUE_CHANGE, now));
            items.forEach(TicketingItem::detachEventSeat);
            // 연결 끊기를 먼저 DB 에 내보내야 회차 좌석 벌크 삭제가 FK 에 걸리지 않는다.
            ticketingItemRepository.flush();
            eventSeatRepository.deleteAllByIdInBatch(eventSeats.stream().map(EventSeat::getSeq).toList());
            eventSeats.stream().map(es -> es.getEvent().getEventId()).distinct()
                    .forEach(seatViewSnapshotCache::evict);
        }
    }
}
