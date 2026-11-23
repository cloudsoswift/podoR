package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.event.dto.EventResponse;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * host 화면의 "내 회차" 목록. /events/mine 은 공개 GET 패턴(/events/*)에 걸리므로 /users/me 아래에 둔다.
 */
@RestController
@RequiredArgsConstructor
public class HostedEventController {

    private final EventRepository eventRepository;

    @GetMapping("/users/me/hosted-events")
    @PreAuthorize("hasAnyRole('HOST','ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<List<EventResponse>> hostedEvents(Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(eventRepository
                .findAllByHost_SeqAndDeletedDateIsNullOrderByEventDateDesc(userSeq)
                .stream().map(EventResponse::new).toList());
    }
}
