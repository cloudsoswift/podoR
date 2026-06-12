package cloudsoswift.podoR.domain.venue.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 좌석맵 일괄 등록 요청.
 * SectionEditor 의 섹션 배치(layoutJson)와 SeatEditor 의 좌석 목록(seats)을 한 번에 받는다.
 */
@Getter
@NoArgsConstructor
public class VenueSeatmapRequest {
    // 섹션 배치(Section[]) JSON 문자열. VenueLayout 에 그대로 저장한다.
    private String layoutJson;
    // 저장할 좌석 목록(사용 좌석만).
    private List<SeatItem> seats;

    @Getter
    @NoArgsConstructor
    public static class SeatItem {
        private String section;     // 섹션 이름
        private String rowNumber;   // 행 라벨(A, B, C...)
        private Integer seatNumber; // 행 내 좌석 번호(결번 허용)
        private Boolean isAvailable; // 판매 가능 여부(null 이면 true)
    }
}
