package cloudsoswift.podoR.domain.event.controller;

import cloudsoswift.podoR.domain.event.dto.EventSeriesResponse;
import cloudsoswift.podoR.domain.event.dto.EventCreateRequest;
import cloudsoswift.podoR.domain.event.dto.EventResponse;
import cloudsoswift.podoR.domain.event.dto.EventUpdateRequest;
import cloudsoswift.podoR.domain.event.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/events")
public class EventController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<Page<EventResponse>> getList(
            @RequestParam(required = false) String keyword,
            Pageable pageable) {
        return ResponseEntity.ok(eventService.getList(keyword, pageable));
    }

    @GetMapping("/series-summary")
    public ResponseEntity<Page<EventSeriesResponse>> getEventSeries(Pageable pageable) {
        return ResponseEntity.ok(eventService.getEventSeries(pageable));
    }

    @GetMapping("/series/{seriesId}")
    public ResponseEntity<java.util.List<EventResponse>> getSessions(@PathVariable String seriesId) {
        return ResponseEntity.ok(eventService.getSessions(seriesId));
    }

    @GetMapping("/{eventId}")
    public ResponseEntity<EventResponse> getOne(@PathVariable String eventId) {
        return ResponseEntity.ok(eventService.getOne(eventId));
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@RequestBody EventCreateRequest request,
                                                Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        EventResponse response = eventService.create(userSeq, request);
        return ResponseEntity.created(URI.create("/events/" + response.getEventId())).body(response);
    }

    @PutMapping("/{eventId}")
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<EventResponse> update(@PathVariable String eventId,
                                                @RequestBody EventUpdateRequest request) {
        return ResponseEntity.ok(eventService.update(eventId, request));
    }

    @DeleteMapping("/{eventId}")
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String eventId) {
        eventService.delete(eventId);
        return ResponseEntity.noContent().build();
    }
}
