package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.venue.dto.SeatmapCancelPreview;
import lombok.Getter;

/** 좌석맵 저장이 예매를 취소하게 되는데 관리자 확인 수가 없거나 다를 때. 트랜잭션은 롤백된다. */
@Getter
public class SeatmapCancelConfirmRequiredException extends RuntimeException {
    private final transient SeatmapCancelPreview preview;

    public SeatmapCancelConfirmRequiredException(SeatmapCancelPreview preview) {
        super("이 저장으로 예매 " + preview.getCancelSeatCount() + "석이 취소됩니다. 확인이 필요합니다.");
        this.preview = preview;
    }
}
