package cloudsoswift.podoR.domain.event.service;

import cloudsoswift.podoR.domain.event.dto.EventCreateRequest;
import cloudsoswift.podoR.domain.event.dto.EventResponse;
import cloudsoswift.podoR.domain.event.dto.EventUpdateRequest;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
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

    public Page<EventResponse> getList(Pageable pageable) {
        return eventRepository.findAllByDeletedDateIsNull(pageable).map(EventResponse::new);
    }

    public EventResponse getOne(String eventId) {
        return new EventResponse(findActiveEvent(eventId));
    }

    @Transactional
    public EventResponse create(Long userSeq, EventCreateRequest request) {
        User host = userService.findBySeq(userSeq);
        Venue venue = findVenue(request.getVenueSeq());
        Event event = Event.builder()
                .host(host)
                .eventId(UUID.randomUUID().toString())
                .title(request.getTitle())
                .content(request.getContent())
                .eventType(request.getEventType())
                .eventDate(request.getEventDate())
                .ticketingDate(request.getTicketingDate())
                .streamStatus("SCHEDULED")
                .venue(venue)
                .build();
        return new EventResponse(eventRepository.save(event));
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
        return venueRepository.findById(venueSeq)
                .orElseThrow(() -> new RuntimeException("Venue not found: " + venueSeq));
    }
}
