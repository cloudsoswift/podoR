package cloudsoswift.podoR.domain.event.service;

import cloudsoswift.podoR.domain.event.dto.EventSeriesResponse;
import cloudsoswift.podoR.domain.event.dto.EventCreateRequest;
import cloudsoswift.podoR.domain.event.dto.EventResponse;
import cloudsoswift.podoR.domain.event.dto.EventUpdateRequest;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeries;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeriesRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.service.UserService;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final VenueRepository venueRepository;
    private final UserService userService;
    private final EventSeriesRepository eventSeriesRepository;

    private static final int DEFAULT_MAX_SEATS_PER_PERSON = 4;

    public Page<EventResponse> getList(String keyword, Pageable pageable) {
        String kw = (keyword != null && !keyword.isBlank()) ? keyword.trim() : null;
        Page<Event> events = (kw == null)
                ? eventRepository.findAllByDeletedDateIsNull(pageable)
                : eventRepository.searchActiveEvents(kw, pageable);
        return events.map(EventResponse::new);
    }

    public EventResponse getOne(String eventId) {
        Event event = findActiveEvent(eventId);
        EventResponse response = new EventResponse(event);
        eventSeriesRepository.findBySeriesId(event.getSeriesId())
                .ifPresent(s -> response.setMaxSeatsPerPerson(s.getMaxSeatsPerPerson()));
        return response;
    }

    public Page<EventSeriesResponse> getEventSeries(Pageable pageable) {
        return eventRepository.findEventSeries(pageable);
    }

    public java.util.List<EventResponse> getSessions(String seriesId) {
        return eventRepository.findAllBySeriesIdAndDeletedDateIsNullOrderByEventDateAsc(seriesId)
                .stream().map(EventResponse::new).toList();
    }

    @Transactional
    public EventResponse create(Long userSeq, EventCreateRequest request) {
        User host = userService.findBySeq(userSeq);
        Venue venue = findVenue(request.getVenueSeq());
        Event event = Event.builder()
                .host(host)
                .eventId(UUID.randomUUID().toString())
                .seriesId(UUID.randomUUID().toString())
                .title(request.getTitle())
                .content(request.getContent())
                .eventType(request.getEventType())
                .eventDate(request.getEventDate())
                .ticketingDate(request.getTicketingDate())
                .streamStatus("SCHEDULED")
                .venue(venue)
                .build();
        Event saved = eventRepository.save(event);
        int max = (request.getMaxSeatsPerPerson() != null && request.getMaxSeatsPerPerson() > 0)
                ? request.getMaxSeatsPerPerson() : DEFAULT_MAX_SEATS_PER_PERSON;
        eventSeriesRepository.save(EventSeries.builder()
                .seriesId(saved.getSeriesId())
                .maxSeatsPerPerson(max)
                .build());
        return new EventResponse(saved);
    }

    @Transactional
    public EventResponse update(String eventId, EventUpdateRequest request) {
        Event event = findActiveEvent(eventId);
        Venue venue = findVenue(request.getVenueSeq());
        event.update(request.getTitle(), request.getContent(), request.getEventType(),
                request.getEventDate(), request.getTicketingDate(), venue);
        return new EventResponse(event);
    }

    @Transactional
    public void delete(String eventId) {
        findActiveEvent(eventId).softDelete();
    }

    private Event findActiveEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found: " + eventId));
    }

    private Venue findVenue(Long venueSeq) {
        // soft-deleted 공연장은 이벤트에 연결할 수 없도록 활성 Venue 만 조회
        return venueRepository.findBySeqAndDeletedAtIsNull(venueSeq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + venueSeq));
    }
}
