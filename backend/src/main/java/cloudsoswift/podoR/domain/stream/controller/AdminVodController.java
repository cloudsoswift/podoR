package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.stream.vod.VodService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/events/{eventId}/vod")
@PreAuthorize("hasRole('ADMIN')")
public class AdminVodController {

    private final VodService vodService;

    @PostMapping("/retry")
    public ResponseEntity<Void> retry(@PathVariable String eventId) {
        vodService.retry(eventId);
        return ResponseEntity.accepted().build();
    }
}
