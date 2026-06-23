package cloudsoswift.podoR.domain.event.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.dto.EventSeatPlanRequest;
import cloudsoswift.podoR.domain.event.dto.EventSeatPlanResponse;
import cloudsoswift.podoR.domain.event.dto.SeatKey;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 이벤트 좌석 플랜(등급·섹션등급·제외좌석)을 기존 EventSeat 와 diff 로 반영한다.
 * - 목표 좌석 = venue Seat 중 isAvailable=true AND 섹션 graded AND not excluded
 * - 생성/삭제/등급변경된 좌석만 change_version 을 새로 발급(증분 피드와 일치)
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class EventSeatPlanService {

    private final EventRepository eventRepository;
    private final EventSeatRepository eventSeatRepository;
    private final SeatRepository seatRepository;
    private final SeatVersionGenerator versionGenerator;
    private final SeatViewSnapshotCache seatViewSnapshotCache;

    /** 재편집용: 기존 EventSeat 로 현재 플랜을 역산. */
    public EventSeatPlanResponse getPlan(String eventId) {
        Event event = findEvent(eventId);
        List<EventSeat> existing = eventSeatRepository.findAllByEventSeqWithSeat(event.getSeq());

        Map<String, String> sectionGrades = new LinkedHashMap<>();
        LinkedHashMap<String, Integer> priceByGrade = new LinkedHashMap<>();
        List<SeatKey> sellable = new ArrayList<>();
        for (EventSeat es : existing) {
            Seat seat = es.getSeat();
            sellable.add(new SeatKey(seat.getSection(), seat.getRowNumber(), seat.getSeatNumber()));
            sectionGrades.putIfAbsent(seat.getSection(), es.getSeatGrade());
            priceByGrade.putIfAbsent(es.getSeatGrade(), es.getPrice());
        }
        List<EventSeatPlanRequest.GradeItem> grades = new ArrayList<>();
        for (Map.Entry<String, Integer> e : priceByGrade.entrySet()) {
            grades.add(EventSeatPlanRequest.GradeItem.of(e.getKey(), e.getValue()));
        }
        return new EventSeatPlanResponse(grades, sectionGrades, sellable);
    }

    /** 좌석 플랜 저장: 목표 좌석 집합과 기존 EventSeat 를 diff 로 반영. */
    @Transactional
    public void savePlan(String eventId, EventSeatPlanRequest req) {
        Event event = findEvent(eventId);

        Map<String, String> sectionGrades = req.getSectionGrades() != null ? req.getSectionGrades() : Map.of();
        Map<String, Integer> priceByGrade = new HashMap<>();
        if (req.getGrades() != null) {
            for (EventSeatPlanRequest.GradeItem g : req.getGrades()) {
                if (g.getGrade() != null) priceByGrade.put(g.getGrade(), g.getPrice());
            }
        }
        // sectionGrades 가 참조하는 grade 는 등급표에 있어야 함
        for (String grade : sectionGrades.values()) {
            if (!priceByGrade.containsKey(grade)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown grade: " + grade);
            }
        }
        Set<SeatKey> excluded = new HashSet<>(req.getExcludedSeats() != null ? req.getExcludedSeats() : List.of());

        // 목표 좌석: venue Seat 중 isAvailable=true AND 섹션 graded AND not excluded
        List<Seat> venueSeats = seatRepository.findByVenueSeq(event.getVenue().getSeq());
        Map<Long, Seat> targetBySeatSeq = new LinkedHashMap<>();
        for (Seat seat : venueSeats) {
            if (Boolean.FALSE.equals(seat.getIsAvailable())) continue;
            String grade = sectionGrades.get(seat.getSection());
            if (grade == null) continue; // 미판매 섹션
            SeatKey key = new SeatKey(seat.getSection(), seat.getRowNumber(), seat.getSeatNumber());
            if (excluded.contains(key)) continue; // 개별 제외
            targetBySeatSeq.put(seat.getSeq(), seat);
        }

        List<EventSeat> existing = eventSeatRepository.findAllByEventSeqWithSeat(event.getSeq());
        Map<Long, EventSeat> existingBySeatSeq = new HashMap<>();
        for (EventSeat es : existing) existingBySeatSeq.put(es.getSeat().getSeq(), es);

        // 삭제: 기존엔 있는데 목표 아님 (Phase 2: SOLD/HELD 면 차단 가드 추가)
        for (EventSeat es : existing) {
            if (!targetBySeatSeq.containsKey(es.getSeat().getSeq())) {
                eventSeatRepository.delete(es);
            }
        }
        // 생성/갱신
        List<EventSeat> toCreate = new ArrayList<>();
        for (Map.Entry<Long, Seat> e : targetBySeatSeq.entrySet()) {
            Seat seat = e.getValue();
            String grade = sectionGrades.get(seat.getSection());
            int price = priceByGrade.get(grade);
            EventSeat es = existingBySeatSeq.get(seat.getSeq());
            if (es == null) {
                toCreate.add(EventSeat.builder()
                        .event(event).seat(seat)
                        .seatGrade(grade).price(price)
                        .status(SeatStatus.AVAILABLE)
                        .changeVersion(versionGenerator.next(event.getSeq()))
                        .build());
            } else if (!es.getSeatGrade().equals(grade) || !es.getPrice().equals(price)) {
                es.updatePricing(grade, price, versionGenerator.next(event.getSeq()));
            }
            // 변동 없으면 그대로(changeVersion 유지)
        }
        if (!toCreate.isEmpty()) eventSeatRepository.saveAll(toCreate);
        // 좌석 플랜이 바뀌었으니 seat-view 스냅샷 캐시 무효화
        seatViewSnapshotCache.evict(eventId);
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }
}
