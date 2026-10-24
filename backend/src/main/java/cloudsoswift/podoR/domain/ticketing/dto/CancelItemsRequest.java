package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/** 부분 취소 요청: 취소할 주문 항목(ticketing_item) seq 목록. */
@Getter
@NoArgsConstructor
public class CancelItemsRequest {
    private List<Long> ticketingItemSeqs;
}
