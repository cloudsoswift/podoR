package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.payment.ConfirmResult;
import cloudsoswift.podoR.domain.ticketing.payment.OrderConfirmFailedException;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGateway;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 결제 확정·실패 기록.
 *
 * <p>확정은 트랜잭션 두 개로 나눈다.
 * <ul>
 *   <li>A: 검증 → 좌석 AVAILABLE→SOLD → 주문 PAID → PG 승인 → 결제 COMPLETED. 하나라도 실패하면 A 전체가 롤백된다.
 *       승인 성공 뒤 A 가 롤백되면(커밋 실패 포함) 보상으로 PG 전액 취소를 부른다 — "돈은 나갔는데 표가 없는" 상태를 남기지 않는다.
 *       Redis 정리(선점 해제·스냅샷 evict·대기열 반납)는 커밋 뒤에만 한다 — 롤백됐는데 선점이 풀리면 안 된다.</li>
 *   <li>B: A 가 실패하면 별도 트랜잭션으로 주문 FAILED + 결제 실패 사유를 남긴다(A 롤백과 무관하게 남도록).</li>
 * </ul>
 * 클라이언트가 보낸 금액은 믿지 않는다 — 서버 주문 금액과 대조만 하고, PG 에는 서버 금액을 보낸다.
 */
@Slf4j
@Service
public class PaymentConfirmService {

    static final String COMPENSATE_REASON = "주문 확정 실패";
    static final String GATEWAY_UNAVAILABLE = "GATEWAY_UNAVAILABLE";
    static final String UNKNOWN = "UNKNOWN";
    private static final int MAX_FAIL_CODE = 50;
    private static final int MAX_FAIL_MESSAGE = 500;

    private final TicketingOrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final EventSeatRepository eventSeatRepository;
    private final SeatVersionGenerator seatVersionGenerator;
    private final SeatHoldService seatHoldService;
    private final PaymentGateway gateway;
    private final TicketingOrderService ticketingOrderService;
    private final TransactionTemplate txA;
    private final TransactionTemplate txB;

    public PaymentConfirmService(TicketingOrderRepository orderRepository,
                                 PaymentRepository paymentRepository,
                                 EventSeatRepository eventSeatRepository,
                                 SeatVersionGenerator seatVersionGenerator,
                                 SeatHoldService seatHoldService,
                                 PaymentGateway gateway,
                                 TicketingOrderService ticketingOrderService,
                                 PlatformTransactionManager transactionManager) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.eventSeatRepository = eventSeatRepository;
        this.seatVersionGenerator = seatVersionGenerator;
        this.seatHoldService = seatHoldService;
        this.gateway = gateway;
        this.ticketingOrderService = ticketingOrderService;
        this.txA = new TransactionTemplate(transactionManager);
        this.txB = new TransactionTemplate(transactionManager);
        this.txB.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** 한 번의 확정 시도에서 트랜잭션 A 안팎이 공유하는 상태. */
    private static final class Attempt {
        boolean approved;      // PG 승인 성공
        boolean compensated;   // 보상 취소를 이미 호출함(중복 호출 방지)
        Long serverAmount;     // 서버가 계산한 주문 금액(PG 승인·보상 취소는 이 금액으로)
        String seriesId;
        List<Long> seatSeqs;
    }

    public OrderCreatedResponse confirm(String eventId, Long userSeq, String orderNumber, String paymentKey, long amount) {
        Attempt attempt = new Attempt();
        try {
            return txA.execute(status -> confirmInTx(eventId, userSeq, orderNumber, paymentKey, amount, attempt));
        } catch (OrderConfirmFailedException e) {
            // 같은 결제의 동시 확정(이중 호출)에서 진 쪽은 좌석이 이미 SOLD 라 SEAT_SOLD 가 난다. 이긴 쪽이 확정했으면 성공으로 본다.
            if (Boolean.TRUE.equals(confirmedWith(orderNumber, paymentKey))) {
                return new OrderCreatedResponse(orderNumber);
            }
            recordFailure(orderNumber, e.getCode(), e.getMessage());
            throw e;
        } catch (PaymentGatewayException e) {
            if (isOutcomeUnknown(e) && attempt.serverAmount != null) {
                // 타임아웃·네트워크 오류·해석 불가 응답은 승인 여부를 모른다(토스는 승인했을 수 있음). 혹시 모를 승인을 되돌린다.
                compensateOnce(attempt, paymentKey, orderNumber);
            }
            recordFailure(orderNumber, e.code(), e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            if (!attempt.approved) throw e;
            // 승인 뒤 A 가 실패(커밋 실패 등). afterCompletion 이 STATUS_UNKNOWN 이면 실제로 커밋됐을 수도 있으니
            // DB 를 새 트랜잭션으로 다시 읽어 판정한다.
            Boolean committed = confirmedWith(orderNumber, paymentKey);
            if (Boolean.TRUE.equals(committed)) {
                log.warn("커밋 예외가 났지만 주문은 확정됨 orderNumber={}", orderNumber, e);
                finishQuietly(eventId, userSeq, attempt);
                return new OrderCreatedResponse(orderNumber);
            }
            if (committed == null) {
                // 상태를 읽지도 못하면 취소도 확정도 단정할 수 없다(결제 없는 표/표 없는 결제 둘 다 위험). 수동 확인으로 넘긴다.
                log.error("승인 후 주문 상태 확인 불가 — 수동 확인 필요 orderNumber={} paymentKey={} amount={}",
                        orderNumber, paymentKey, attempt.serverAmount, e);
                throw e;
            }
            log.error("승인 후 주문 확정 실패 orderNumber={} paymentKey={}", orderNumber, paymentKey, e);
            compensateOnce(attempt, paymentKey, orderNumber);
            recordFailure(orderNumber, "CONFIRM_FAILED", "주문 확정 중 오류가 발생해 결제를 취소했습니다.");
            throw e;
        }
    }

    /** 승인 결과를 알 수 없는 PG 오류: 통신 실패(GATEWAY_UNAVAILABLE), 해석할 수 없는 오류 응답(UNKNOWN). */
    private static boolean isOutcomeUnknown(PaymentGatewayException e) {
        return GATEWAY_UNAVAILABLE.equals(e.code()) || UNKNOWN.equals(e.code());
    }

    private OrderCreatedResponse confirmInTx(String eventId, Long userSeq, String orderNumber,
                                             String paymentKey, long amount, Attempt attempt) {
        TicketingOrder order = findMyOrder(eventId, userSeq, orderNumber);
        Payment payment = paymentRepository.findByTicketingOrder_Seq(order.getSeq())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "결제 정보가 없습니다."));

        if (TicketingOrder.STATUS_PAID.equals(order.getStatus())) {
            // 같은 결제로 다시 확정(새로고침·StrictMode 이중 호출): 이미 끝났으니 그대로 성공. PG 는 다시 부르지 않는다.
            if (paymentKey.equals(payment.getPaymentKey())) {
                return new OrderCreatedResponse(order.getOrderNumber());
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 다른 결제로 확정된 주문입니다.");
        }
        if (!order.isPending()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "결제를 진행할 수 없는 주문입니다.");
        }
        long expected = order.getTotalPrice().longValue();
        if (amount != expected) {
            throw new OrderConfirmFailedException(HttpStatus.BAD_REQUEST, "AMOUNT_MISMATCH",
                    "결제 금액이 주문 금액과 다릅니다.");
        }
        List<Long> seatSeqs = order.eventSeatSeqs();
        if (!seatHoldService.ownsAll(userSeq, seatSeqs)) {
            throw new OrderConfirmFailedException(HttpStatus.CONFLICT, "HOLD_EXPIRED",
                    "좌석 선점 시간이 만료되었습니다. 좌석을 다시 선택해 주세요.");
        }

        Long eventSeq = order.getEvent().getSeq();
        int affected = eventSeatRepository.updateStatusIfCurrent(seatSeqs, eventSeq,
                SeatStatus.AVAILABLE, SeatStatus.SOLD, seatVersionGenerator.next(eventSeq));
        if (affected != seatSeqs.size()) {
            throw new OrderConfirmFailedException(HttpStatus.CONFLICT, "SEAT_SOLD",
                    "이미 판매된 좌석이 있습니다. 좌석을 다시 선택해 주세요.");
        }
        order.markPaid();

        attempt.serverAmount = expected;
        attempt.seriesId = order.getEvent().getSeriesId();
        attempt.seatSeqs = seatSeqs;
        ConfirmResult result = gateway.confirm(paymentKey, order.getOrderNumber(), expected);
        attempt.approved = true;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                // 판매는 이미 커밋됐다. Redis 정리 실패로 성공 응답을 에러로 바꾸지 않는다(선점·입장권은 TTL 로 만료).
                finishQuietly(eventId, userSeq, attempt);
            }

            @Override
            public void afterCompletion(int status) {
                // 확실히 롤백된 경우만 여기서 취소한다. STATUS_UNKNOWN 은 커밋됐을 수 있으니 confirm() 이 DB 를 다시 읽고 판정한다.
                if (status == STATUS_ROLLED_BACK) {
                    compensateOnce(attempt, paymentKey, orderNumber);
                }
            }
        });
        payment.complete(paymentKey, result.method(), LocalDateTime.now());
        return new OrderCreatedResponse(order.getOrderNumber());
    }

    private void finishQuietly(String eventId, Long userSeq, Attempt attempt) {
        try {
            ticketingOrderService.finishConfirmed(eventId, userSeq, attempt.seriesId, attempt.seatSeqs);
        } catch (RuntimeException e) {
            log.warn("확정 후처리(선점 해제·캐시·대기열) 실패 — TTL 로 정리됨 eventId={} userSeq={}", eventId, userSeq, e);
        }
    }

    /** 결제창 실패·취소 기록. PENDING 이면 FAILED, 이미 끝난 주문이면 무시. 선점은 풀지 않는다(같은 좌석으로 다시 결제). */
    @Transactional
    public void fail(String eventId, Long userSeq, String orderNumber, String code, String message) {
        TicketingOrder order = findMyOrder(eventId, userSeq, orderNumber);
        if (!order.isPending()) return;
        markFailed(order, code, message);
    }

    private TicketingOrder findMyOrder(String eventId, Long userSeq, String orderNumber) {
        return orderRepository.findDetailByOrderNumber(orderNumber)
                .filter(o -> o.getUser().getSeq().equals(userSeq))
                .filter(o -> o.getEvent().getEventId().equals(eventId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    /** 주문이 이 paymentKey 로 PAID 인지 새 트랜잭션에서 확인. 읽기 자체가 실패하면 null(모름). */
    private Boolean confirmedWith(String orderNumber, String paymentKey) {
        try {
            return txB.execute(status -> orderRepository.findDetailByOrderNumber(orderNumber)
                    .filter(o -> TicketingOrder.STATUS_PAID.equals(o.getStatus()))
                    .flatMap(o -> paymentRepository.findByTicketingOrder_Seq(o.getSeq()))
                    .map(p -> paymentKey.equals(p.getPaymentKey()))
                    .orElse(false));
        } catch (RuntimeException e) {
            log.error("주문 상태 확인 실패 orderNumber={}", orderNumber, e);
            return null;
        }
    }

    /** 트랜잭션 B: A 의 롤백과 무관하게 실패를 남긴다. 기록 자체가 실패해도 원래 예외를 가리지 않는다. */
    private void recordFailure(String orderNumber, String code, String message) {
        try {
            txB.executeWithoutResult(status -> orderRepository.findDetailByOrderNumber(orderNumber)
                    .filter(TicketingOrder::isPending)
                    .ifPresent(order -> markFailed(order, code, message)));
        } catch (RuntimeException e) {
            log.error("결제 실패 기록 실패 orderNumber={} code={}", orderNumber, code, e);
        }
    }

    private void markFailed(TicketingOrder order, String code, String message) {
        order.markFailed();
        paymentRepository.findByTicketingOrder_Seq(order.getSeq())
                .ifPresent(p -> p.fail(truncate(code, MAX_FAIL_CODE), truncate(message, MAX_FAIL_MESSAGE)));
    }

    /** 보상 전액 취소. 승인 1건당 한 번만 일어나므로 멱등키를 주문번호로 고정한다. 실패는 로그만(수동 정리 대상). */
    private void compensateOnce(Attempt attempt, String paymentKey, String orderNumber) {
        if (attempt.compensated) return;
        attempt.compensated = true;
        long amount = attempt.serverAmount;
        try {
            gateway.cancel(paymentKey, amount, COMPENSATE_REASON, "compensate-" + orderNumber);
            log.warn("보상 취소 완료 orderNumber={} paymentKey={}", orderNumber, paymentKey);
        } catch (RuntimeException e) {
            log.error("보상 취소 실패 — 수동 확인 필요 orderNumber={} paymentKey={} amount={}",
                    orderNumber, paymentKey, amount, e);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
