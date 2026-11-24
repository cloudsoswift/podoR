package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 취소 가능 여부와 좌석별 환불액을 정한다.
 * 환불 수수료 규정(예: D-7 까지 10%, D-4 까지 20%)은 이 구현을 바꿔 넣는다 —
 * {@link RefundDecision#refunds()} 가 좌석별 실제 환불액이다.
 */
public interface RefundPolicy {

    RefundDecision evaluate(TicketingOrder order, List<TicketingItem> items, CancelReason reason, LocalDateTime now);

    /** 관객 취소 마감 시각. 이 시각부터는 관객 취소를 거절한다. */
    LocalDateTime userCancelDeadline(TicketingOrder order);
}
