package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.stream.dto.StreamKeyResponse;
import cloudsoswift.podoR.domain.stream.service.StreamKeyService;
import cloudsoswift.podoR.domain.stream.service.StreamLifecycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** 회차 host(또는 ADMIN)의 송출 관리. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}")
public class StreamHostController {

    private final StreamKeyService streamKeyService;
    private final StreamLifecycleService lifecycleService;

    @GetMapping("/stream-key")
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<StreamKeyResponse> getStreamKey(@PathVariable String eventId) {
        return ResponseEntity.ok(streamKeyService.getOrIssue(eventId));
    }

    @PostMapping("/stream-key/reissue")
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<StreamKeyResponse> reissue(@PathVariable String eventId) {
        return ResponseEntity.ok(streamKeyService.reissue(eventId));
    }

    @PostMapping("/stream/end")
    @PreAuthorize("@eventSecurity.isOwner(#eventId) or hasRole('ADMIN')")
    public ResponseEntity<Void> end(@PathVariable String eventId) {
        lifecycleService.endByHost(eventId);
        return ResponseEntity.noContent().build();
    }
}
