package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGateway;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 예매 취소의 유일한 경로(관객 취소, 공연장 배치 변경 취소).
 * 환불 정책 판단 → 주문·항목 취소(사유·환불액 기록) → 결제 환불액 누적 → PG 환불을 한다.
 * PG 환불은 호출부 트랜잭션 안에서 부르므로, 실패하면 예외로 DB 변경까지 롤백된다(취소됐는데 환불 안 된 상태 방지).
 * 회차 좌석 후처리(되돌리기/삭제)와 좌석맵 캐시는 호출부 책임이다.
 */
@Service
@RequiredArgsConstructor
public class CancellationService {

    private final RefundPolicy refundPolicy;
    private final PaymentGateway paymentGateway;

    /** 단위 테스트(직접 생성)에서는 null. 있으면 PG 호출 전에 flush 해 DB 충돌(낙관적 락 등)을 먼저 드러낸다. */
    @PersistenceContext
    private EntityManager entityManager;

    /** @return 이번에 환불한 금액 합 */
    public int cancel(TicketingOrder order, List<TicketingItem> items, CancelReason reason, LocalDateTime now) {
        return cancel(order, items, reason, now, () -> {
        });
    }

    /**
     * beforeRefund: 정책 통과·DB 변경 뒤, PG 환불 직전에 실행할 호출부 작업(예: 회차 좌석 되돌리기).
     * PG 환불이 커밋 전 마지막 실패 가능 단계가 되도록, 실패할 수 있는 후처리는 여기 넣거나 커밋 후로 미룬다.
     *
     * @return 이번에 환불한 금액 합
     */
    public int cancel(TicketingOrder order, List<TicketingItem> items, CancelReason reason, LocalDateTime now,
                      Runnable beforeRefund) {
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
        beforeRefund.run();
        if (payment != null) {
            // paymentKey 없는 기존 결제, MOCK 결제(게이트웨이를 toss 로 바꾼 뒤에도), 0원 환불은 PG 를 부르지 않는다.
            if (payment.getPaymentKey() != null && !isMockPayment(payment) && refunded > 0) {
                if (entityManager != null) {
                    entityManager.flush();
                }
                paymentGateway.cancel(payment.getPaymentKey(), refunded, reasonText(reason),
                        idempotencyKey(order, items));
            }
        }
        return refunded;
    }

    private static boolean isMockPayment(Payment payment) {
        return "MOCK".equals(payment.getMethod()) || payment.getPaymentKey().startsWith("mock-");
    }

    /**
     * 주문 하나를 별도 트랜잭션으로 취소·환불한다(공연장 배치 변경 일괄 취소용).
     * 호출부의 영속성 컨텍스트와 분리되므로 id 로 다시 읽는다. 반드시 다른 빈에서 프록시를 거쳐 호출할 것.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cancelInNewTransaction(Long orderSeq, List<Long> itemSeqs, CancelReason reason, LocalDateTime now) {
        TicketingOrder order = entityManager.find(TicketingOrder.class, orderSeq);
        if (order == null) {
            throw new IllegalStateException("주문이 없습니다: " + orderSeq);
        }
        List<TicketingItem> items = new ArrayList<>();
        for (Long seq : itemSeqs) {
            TicketingItem item = order.getItems().stream()
                    .filter(i -> Objects.equals(i.getSeq(), seq))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("주문의 항목이 아닙니다: " + seq));
            items.add(item);
        }
        return cancel(order, items, reason, now);
    }

    public LocalDateTime userCancelDeadline(TicketingOrder order) {
        return refundPolicy.userCancelDeadline(order);
    }

    /** 같은 주문의 같은 항목 취소는 같은 키 → PG 가 중복 환불을 막는다. SHA-256(주문번호:항목 seq 오름차순 콤마 결합) hex. */
    public static String idempotencyKey(TicketingOrder order, Collection<TicketingItem> items) {
        String seqs = items.stream().map(TicketingItem::getSeq).sorted()
                .map(String::valueOf).collect(Collectors.joining(","));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((order.getOrderNumber() + ":" + seqs).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String reasonText(CancelReason reason) {
        return switch (reason) {
            case USER -> "관객 취소";
            case VENUE_CHANGE -> "공연장 사정으로 취소";
        };
    }
}
