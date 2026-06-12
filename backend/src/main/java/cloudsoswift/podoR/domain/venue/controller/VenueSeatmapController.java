package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapResponse;
import cloudsoswift.podoR.domain.venue.service.VenueSeatmapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
}
