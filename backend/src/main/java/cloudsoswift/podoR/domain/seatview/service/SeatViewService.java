package cloudsoswift.podoR.domain.seatview.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewChangesResponse;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewResponse;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewSeatDto;
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

    public SeatViewResponse getSnapshot(String eventId) {
        return snapshotCache.get(eventId).orElseGet(() -> {
            SeatViewResponse fresh = buildSnapshot(eventId);
            snapshotCache.put(fresh);
            return fresh;
        });
    }

    private SeatViewResponse buildSnapshot(String eventId) {
        Event event = findEvent(eventId);
        List<EventSeat> seats = eventSeatRepository.findAllByEventSeqWithSeat(event.getSeq());
        long cursor = seats.stream().mapToLong(EventSeat::getChangeVersion).max().orElse(0L);
        String layoutJson = venueLayoutRepository.findByVenueSeq(event.getVenue().getSeq())
                .map(l -> l.getLayoutJson()).orElse(null);
        List<SeatViewSeatDto> dtos = seats.stream().map(SeatViewSeatDto::from).toList();
        return new SeatViewResponse(eventId, cursor, layoutJson, dtos);
    }

    public SeatViewChangesResponse getChanges(String eventId, long since, String section) {
        Event event = findEvent(eventId);
        List<EventSeat> changed = (section == null || section.isBlank())
                ? eventSeatRepository.findChangesSince(event.getSeq(), since)
                : eventSeatRepository.findChangesSinceInSection(event.getSeq(), since, section);
        long cursor = changed.stream().mapToLong(EventSeat::getChangeVersion).max().orElse(since);
        return new SeatViewChangesResponse(cursor, changed.stream().map(SeatViewSeatDto::from).toList());
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }
}
