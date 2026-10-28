package cloudsoswift.podoR.domain.venue.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 좌석맵 일괄 등록 요청.
 * 섹션 배치(layoutJson)와 좌석 목록(seats)을 한 번에 받아 기존 좌석과 diff 로 반영한다.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class VenueSeatmapRequest {
    // 섹션 배치 JSON 문자열. VenueLayout 에 그대로 저장한다.
    private String layoutJson;
    // 저장할 좌석 목록(번호 있는 좌석만).
    private List<SeatItem> seats;
    // 이 저장으로 취소될 예매 좌석 수를 관리자가 확인한 값. 서버가 계산한 수와 같아야 저장된다(두 단계 저장).
    private Integer confirmedCancelSeatCount;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeatItem {
        private String section;     // 섹션 이름(표시용)
        private String sectionKey;  // 섹션 id(layoutJson). 좌석 정체성의 일부
        private String rowNumber;   // 줄 이름
        private Integer seatNumber; // 줄 안 좌석 번호
        private Boolean isAvailable; // 판매 가능 여부(null 이면 true)
    }
}
