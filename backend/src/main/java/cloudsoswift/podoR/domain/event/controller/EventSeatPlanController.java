package cloudsoswift.podoR.domain.event.controller;

import cloudsoswift.podoR.domain.event.dto.EventSeatPlanRequest;
import cloudsoswift.podoR.domain.event.dto.EventSeatPlanResponse;
import cloudsoswift.podoR.domain.event.service.EventSeatPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}/seat-plan")
public class EventSeatPlanController {

    private final EventSeatPlanService eventSeatPlanService;

    @GetMapping
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<EventSeatPlanResponse> getPlan(@PathVariable String eventId) {
        return ResponseEntity.ok(eventSeatPlanService.getPlan(eventId));
    }

    @PutMapping
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<Void> savePlan(@PathVariable String eventId,
                                         @RequestBody EventSeatPlanRequest request) {
        eventSeatPlanService.savePlan(eventId, request);
        return ResponseEntity.noContent().build();
    }
}
