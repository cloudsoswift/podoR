package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 예매 취소의 유일한 경로(관객 취소, 공연장 배치 변경 취소).
 * 환불 정책 판단 → 주문·항목 취소(사유·환불액 기록) → 결제 환불액 누적을 한다.
 * 회차 좌석 후처리(되돌리기/삭제)와 좌석맵 캐시는 호출부 책임이다.
 * PG 환불 호출과 결제 확인 캐시 evict 가 생기면 여기에 붙인다.
 */
@Service
@RequiredArgsConstructor
public class CancellationService {

    private final RefundPolicy refundPolicy;

    /** @return 이번에 환불한 금액 합 */
    public int cancel(TicketingOrder order, List<TicketingItem> items, CancelReason reason, LocalDateTime now) {
        if (!order.isCancellable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "취소할 수 없는 주문입니다.");
        }
        RefundDecision decision = refundPolicy.evaluate(order, items, reason, now);
        if (!decision.allowed()) {
            throw new CancellationNotAllowedException(decision.deniedMessage());
        }
        int refunded = order.cancelItems(items, reason, decision::refundOf, now);
        Payment payment = order.getPayment();
        if (payment != null) {
            payment.cancelAmount(refunded, now, TicketingOrder.STATUS_CANCELLED.equals(order.getStatus()));
        }
        return refunded;
    }

    public LocalDateTime userCancelDeadline(TicketingOrder order) {
        return refundPolicy.userCancelDeadline(order);
    }
}
