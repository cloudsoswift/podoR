package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapResponse;
import cloudsoswift.podoR.domain.venue.service.VenueSeatmapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/venues/{venueSeq}/seatmap")
public class VenueSeatmapController {

    private final VenueSeatmapService venueSeatmapService;

    /**
     * 섹션 배치 + 좌석 목록을 한 번에 등록한다.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VenueSeatmapResponse> register(@PathVariable Long venueSeq,
                                                         @RequestBody VenueSeatmapRequest request) {
        return ResponseEntity.ok(venueSeatmapService.register(venueSeq, request));
    }

    /** 검증 실패(예: 섹션 이름 중복)는 400 + {message} 로 내려 프론트가 사유를 표시한다. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
