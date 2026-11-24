package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 현재 환불 정책: 수수료 없이 전액 환불.
 * 관객 취소는 공연 시작 {@code refund.user-cancel-cutoff}(기본 30분) 전부터 막고,
 * 공연장 배치 변경 취소는 마감과 무관하게 허용한다.
 */
@Component
@RequiredArgsConstructor
public class DefaultRefundPolicy implements RefundPolicy {

    private final RefundProperties props;

    @Override
    public RefundDecision evaluate(TicketingOrder order, List<TicketingItem> items, CancelReason reason, LocalDateTime now) {
        if (reason == CancelReason.USER && !now.isBefore(userCancelDeadline(order))) {
            return RefundDecision.denied(
                    "공연 시작 " + props.userCancelCutoff().toMinutes() + "분 전부터는 취소할 수 없습니다.");
        }
        return RefundDecision.fullRefund(items);
    }

    @Override
    public LocalDateTime userCancelDeadline(TicketingOrder order) {
        return order.getEvent().getEventDate().minus(props.userCancelCutoff());
    }
}
