package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.stream.dto.PublishAuthRequest;
import cloudsoswift.podoR.domain.stream.dto.StreamCallbackRequest;
import cloudsoswift.podoR.domain.stream.dto.StreamStartedResponse;
import cloudsoswift.podoR.domain.stream.service.StreamLifecycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/**
 * MediaMTX → Spring 내부 콜백. 외부에서는 nginx 가 /api/internal/ 을 막고,
 * 여기서는 InternalTokenInterceptor 가 공유 비밀을 검사한다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/stream")
public class StreamInternalController {

    private final StreamLifecycleService lifecycleService;

    @PostMapping("/publish-auth")
    public ResponseEntity<Void> publishAuth(@RequestBody PublishAuthRequest request) {
        boolean allowed = lifecycleService.authorize(request, LocalDateTime.now());
        return ResponseEntity.status(allowed ? HttpStatus.OK : HttpStatus.UNAUTHORIZED).build();
    }

    @PostMapping("/started")
    public ResponseEntity<StreamStartedResponse> started(@RequestBody StreamCallbackRequest request) {
        return ResponseEntity.ok(lifecycleService.started(request.streamKey(), LocalDateTime.now()));
    }

    @PostMapping("/stopped")
    public ResponseEntity<Void> stopped(@RequestBody StreamCallbackRequest request) {
        lifecycleService.stopped(request.streamKey(), LocalDateTime.now());
        return ResponseEntity.noContent().build();
    }
}
