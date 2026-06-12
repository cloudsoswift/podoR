package cloudsoswift.podoR.domain.venue.dto;

import lombok.Getter;

/**
 * 좌석맵 일괄 등록 결과.
 */
@Getter
public class VenueSeatmapResponse {
    private Long venueSeq;
    private boolean layoutSaved;
    private int seatCount;

    public VenueSeatmapResponse(Long venueSeq, boolean layoutSaved, int seatCount) {
        this.venueSeq = venueSeq;
        this.layoutSaved = layoutSaved;
        this.seatCount = seatCount;
    }
}
