package cloudsoswift.podoR.domain.seatview.controller;

import cloudsoswift.podoR.domain.seatview.dto.SeatViewChangesResponse;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewResponse;
import cloudsoswift.podoR.domain.seatview.ratelimit.SeatViewRateLimiter;
import cloudsoswift.podoR.domain.seatview.service.SeatViewService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}/seat-view")
public class SeatViewController {

    private final SeatViewService seatViewService;
    private final SeatViewRateLimiter rateLimiter;

    @GetMapping
    public ResponseEntity<SeatViewResponse> snapshot(@PathVariable String eventId) {
        // 스냅샷은 캐시 보호되므로 rate-limit 미적용
        return ResponseEntity.ok(seatViewService.getSnapshot(eventId));
    }

    @GetMapping("/changes")
    public ResponseEntity<SeatViewChangesResponse> changes(
            @PathVariable String eventId,
            @RequestParam(defaultValue = "0") long since,
            @RequestParam(required = false) String section,
            HttpServletRequest request) {
        String ip = clientIp(request);
        if (!rateLimiter.tryAcquire(ip, eventId, section)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded");
        }
        return ResponseEntity.ok(seatViewService.getChanges(eventId, since, section));
    }

    private String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
