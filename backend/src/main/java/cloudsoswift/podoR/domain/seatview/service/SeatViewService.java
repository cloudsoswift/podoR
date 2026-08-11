package cloudsoswift.podoR.domain.seatview.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewChangesResponse;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewResponse;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewSeatDto;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.venue.repository.VenueLayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SeatViewService {

    private final EventRepository eventRepository;
    private final EventSeatRepository eventSeatRepository;
    private final VenueLayoutRepository venueLayoutRepository;
    private final SeatViewSnapshotCache snapshotCache;
    private final SeatHoldService seatHoldService;

    public SeatViewResponse getSnapshot(String eventId) {
        SeatViewResponse cached = snapshotCache.get(eventId).orElseGet(() -> {
            SeatViewResponse fresh = buildSnapshot(eventId);
            snapshotCache.put(fresh);
            return fresh;
        });
        // heldSeats 는 항상 실시간 Redis 로 갱신(캐시된 값 무시)
        List<Long> allSeqs = cached.seats().stream().map(SeatViewSeatDto::eventSeatSeq).toList();
        return new SeatViewResponse(cached.eventId(), cached.cursor(), cached.layoutJson(),
                cached.seats(), seatHoldService.heldAmong(allSeqs));
    }

    private SeatViewResponse buildSnapshot(String eventId) {
        Event event = findEvent(eventId);
        List<EventSeat> seats = eventSeatRepository.findAllByEventSeqWithSeat(event.getSeq());
        long cursor = seats.stream().mapToLong(EventSeat::getChangeVersion).max().orElse(0L);
        String layoutJson = venueLayoutRepository.findByVenueSeq(event.getVenue().getSeq())
                .map(l -> l.getLayoutJson()).orElse(null);
        List<SeatViewSeatDto> dtos = seats.stream().map(SeatViewSeatDto::from).toList();
        // 캐시에는 heldSeats 를 비워 저장(실시간성 위해 getSnapshot 에서 덮어씀)
        return new SeatViewResponse(eventId, cursor, layoutJson, dtos, List.of());
    }

    public SeatViewChangesResponse getChanges(String eventId, long since, String section) {
        Event event = findEvent(eventId);
        List<EventSeat> changed = (section == null || section.isBlank())
                ? eventSeatRepository.findChangesSince(event.getSeq(), since)
                : eventSeatRepository.findChangesSinceInSection(event.getSeq(), since, section);
        long cursor = changed.stream().mapToLong(EventSeat::getChangeVersion).max().orElse(since);
        // 현재 이벤트 전체 좌석 기준 선점 집합(작아서 저렴)
        List<Long> allSeqs = eventSeatRepository.findAllByEventSeqWithSeat(event.getSeq())
                .stream().map(EventSeat::getSeq).toList();
        return new SeatViewChangesResponse(cursor, changed.stream().map(SeatViewSeatDto::from).toList(),
                seatHoldService.heldAmong(allSeqs));
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }
}
