package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.domain.venue.dto.SeatmapCancelPreview;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapResponse;
import cloudsoswift.podoR.domain.venue.service.SeatmapCancelConfirmRequiredException;
import cloudsoswift.podoR.domain.venue.service.VenueSeatmapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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

    /** 저장으로 예매가 취소되는데 확인 수가 없거나 다르면 409 + 미리보기. 프론트가 확인 후 재전송한다. */
    @ExceptionHandler(SeatmapCancelConfirmRequiredException.class)
    public ResponseEntity<SeatmapCancelPreview> handleCancelConfirmRequired(SeatmapCancelConfirmRequiredException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getPreview());
    }

    /** 저장이 같은 주문의 관객 취소와 겹쳐 낙관적 락이 실패하면 409 + {message}. 다시 저장하면 새 미리보기를 받는다. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleConcurrentCancel(ObjectOptimisticLockingFailureException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "예매 취소와 동시에 처리되어 저장하지 못했습니다. 다시 저장해 주세요."));
    }
}
