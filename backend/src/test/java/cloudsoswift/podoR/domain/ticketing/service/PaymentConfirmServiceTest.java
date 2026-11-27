package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.queue.WaitingQueueService;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.payment.MockPaymentGateway;
import cloudsoswift.podoR.domain.ticketing.payment.OrderConfirmFailedException;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 확정·실패 흐름을 실제 트랜잭션(H2)으로 검증한다. 커밋/롤백 경계가 핵심이라 @Transactional 테스트로 감싸지 않는다.
 * Redis 를 쓰는 빈(선점·대기열·좌석 버전·스냅샷 캐시)은 목으로 바꾸고, PG 는 실제 MockPaymentGateway 빈을 쓴다.
 */
@SpringBootTest
class PaymentConfirmServiceTest {

    @Autowired PaymentConfirmService service;
    @Autowired MockPaymentGateway gateway;

    @Autowired UserRepository userRepository;
    @Autowired VenueRepository venueRepository;
    @Autowired SeatRepository seatRepository;
    @Autowired EventRepository eventRepository;
    @Autowired EventSeatRepository eventSeatRepository;
    @Autowired TicketingOrderRepository orderRepository;
    @Autowired TicketingItemRepository itemRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired TicketingOrderService ticketingOrderService;

    @MockitoBean SeatHoldService seatHoldService;
    @MockitoBean WaitingQueueService waitingQueue;
    @MockitoBean SeatVersionGenerator seatVersionGenerator;
    @MockitoBean SeatViewSnapshotCache snapshotCache;

    static final String EVENT_ID = "PC-EVT";
    static final String SERIES = "PC-SERIES";
    static final String PAYMENT_KEY = "pk-test-1";

    User user;
    Event event;
    List<EventSeat> seats;
    String orderNumber;
    long amount;

    @BeforeEach
    void setUp() {
        gateway.reset();
        user = userRepository.save(EntityFixtures.user("pc-user"));
        Venue venue = venueRepository.save(EntityFixtures.venue("pc-venue"));
        event = eventRepository.save(EntityFixtures.event(user, venue, EVENT_ID, SERIES));
        Seat s1 = seatRepository.save(EntityFixtures.seat(venue, "A", "1", 1));
        Seat s2 = seatRepository.save(EntityFixtures.seat(venue, "A", "1", 2));
        seats = List.of(
                eventSeatRepository.save(EntityFixtures.eventSeat(event, s1, SeatStatus.AVAILABLE, 0L)),
                eventSeatRepository.save(EntityFixtures.eventSeat(event, s2, SeatStatus.AVAILABLE, 0L)));
        orderNumber = preparePending("PC-ORDER-1");
        amount = 20000L;
        when(seatHoldService.ownsAll(anyLong(), anyList())).thenReturn(true);
        when(seatVersionGenerator.next(anyLong())).thenReturn(7L);
    }

    @AfterEach
    void tearDown() {
        paymentRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        orderRepository.deleteAllInBatch();
        eventSeatRepository.deleteAllInBatch();
        seatRepository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
        venueRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    private String preparePending(String number) {
        TicketingOrder order = TicketingOrder.pending(event, user, number, seats);
        orderRepository.save(order);
        paymentRepository.save(Payment.ready(order, order.getTotalPrice()));
        return number;
    }

    private TicketingOrder order() {
        return orderRepository.findDetailByOrderNumber(orderNumber).orElseThrow();
    }

    private Payment payment() {
        return paymentRepository.findByTicketingOrder_Seq(order().getSeq()).orElseThrow();
    }

    private List<SeatStatus> seatStatuses() {
        return seats.stream().map(s -> eventSeatRepository.findById(s.getSeq()).orElseThrow().getStatus()).toList();
    }

    @Test
    void 확정하면_좌석SOLD_주문PAID_결제COMPLETED_paymentKey저장_승인1회() {
        var res = service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        assertThat(res.getOrderNumber()).isEqualTo(orderNumber);
        assertThat(seatStatuses()).containsOnly(SeatStatus.SOLD);
        TicketingOrder o = order();
        assertThat(o.getStatus()).isEqualTo(TicketingOrder.STATUS_PAID);
        assertThat(o.getItems()).extracting(TicketingItem::getStatus).containsOnly(TicketingItem.STATUS_PAID);
        Payment p = payment();
        assertThat(p.getStatus()).isEqualTo("COMPLETED");
        assertThat(p.getPaymentKey()).isEqualTo(PAYMENT_KEY);
        assertThat(p.getMethod()).isEqualTo("MOCK");
        assertThat(p.getPaidAt()).isNotNull();
        assertThat(gateway.confirmCalls()).containsExactly(
                new MockPaymentGateway.ConfirmCall(PAYMENT_KEY, orderNumber, amount));
        assertThat(gateway.cancelCalls()).isEmpty();
        // 커밋 후 Redis 정리
        List<Long> seatSeqs = seats.stream().map(EventSeat::getSeq).toList();
        verify(seatHoldService).release(eq(user.getSeq()), eq(SERIES), argThat(l -> l.containsAll(seatSeqs)));
        verify(snapshotCache).evict(EVENT_ID);
        verify(waitingQueue).leave(EVENT_ID, user.getSeq());
    }

    @Test
    void 같은_paymentKey_로_다시_확정하면_성공하고_승인은_한번뿐() {
        service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        var again = service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        assertThat(again.getOrderNumber()).isEqualTo(orderNumber);
        assertThat(gateway.confirmCalls()).hasSize(1);
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_PAID);
    }

    @Test
    void 이미_PAID_인데_다른_paymentKey_면_409() {
        service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, "other-key", amount))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(gateway.confirmCalls()).hasSize(1);
    }

    @Test
    void 남의_주문이거나_없는_주문이면_404() {
        User other = userRepository.save(EntityFixtures.user("pc-other"));

        assertThatThrownBy(() -> service.confirm(EVENT_ID, other.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), "NO-SUCH", PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_PENDING);
        assertThat(gateway.confirmCalls()).isEmpty();
    }

    @Test
    void 금액이_다르면_FAILED_AMOUNT_MISMATCH_이고_승인_안함() {
        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, 100L))
                .isInstanceOfSatisfying(OrderConfirmFailedException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getStatus()).isEqualTo("FAILED");
        assertThat(payment().getFailCode()).isEqualTo("AMOUNT_MISMATCH");
        assertThat(gateway.confirmCalls()).isEmpty();
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
    }

    @Test
    void 선점이_만료됐으면_FAILED_HOLD_EXPIRED_이고_승인_안함() {
        when(seatHoldService.ownsAll(anyLong(), anyList())).thenReturn(false);

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(OrderConfirmFailedException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));

        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("HOLD_EXPIRED");
        assertThat(gateway.confirmCalls()).isEmpty();
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
    }

    @Test
    void 좌석이_이미_팔렸으면_FAILED_SEAT_SOLD_이고_다른_좌석도_되돌린다() {
        EventSeat sold = seats.get(1);
        new TransactionTemplate(transactionManager).executeWithoutResult(st ->
                eventSeatRepository.updateStatusIfCurrent(List.of(sold.getSeq()), event.getSeq(),
                        SeatStatus.AVAILABLE, SeatStatus.SOLD, 1L));

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(OrderConfirmFailedException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));

        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("SEAT_SOLD");
        assertThat(gateway.confirmCalls()).isEmpty();
        // 첫 좌석의 AVAILABLE→SOLD 는 트랜잭션 A 와 함께 롤백된다
        assertThat(eventSeatRepository.findById(seats.get(0).getSeq()).orElseThrow().getStatus())
                .isEqualTo(SeatStatus.AVAILABLE);
    }

    @Test
    void 토스_승인이_실패하면_좌석은_AVAILABLE_주문은_FAILED_사유는_토스코드() {
        gateway.failNext("REJECT_CARD_PAYMENT", "한도초과");

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(PaymentGatewayException.class,
                        e -> assertThat(e.code()).isEqualTo("REJECT_CARD_PAYMENT"));

        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("REJECT_CARD_PAYMENT");
        assertThat(payment().getFailMessage()).isEqualTo("한도초과");
        // 명확한 거절이면 승인된 돈이 없으니 취소하지 않는다
        assertThat(gateway.cancelCalls()).isEmpty();
        verify(seatHoldService, never()).release(anyLong(), anyString(), anyList());
        verify(waitingQueue, never()).leave(anyString(), anyLong());
    }

    @Test
    void 승인_결과를_모르면_보상취소_후_FAILED() {
        gateway.failNext("GATEWAY_UNAVAILABLE", "결제 대행사 통신에 실패했습니다.");

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(PaymentGatewayException.class,
                        e -> assertThat(e.code()).isEqualTo("GATEWAY_UNAVAILABLE"));

        assertThat(gateway.cancelCalls()).containsExactly(new MockPaymentGateway.CancelCall(
                PAYMENT_KEY, amount, "주문 확정 실패", "compensate-" + orderNumber));
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("GATEWAY_UNAVAILABLE");
    }

    @Test
    void 승인_후_커밋이_실패하면_보상취소를_호출한다() {
        gateway.onNextConfirm(() -> TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void beforeCommit(boolean readOnly) {
                        throw new RuntimeException("commit boom");
                    }
                }));

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOf(RuntimeException.class);

        assertThat(gateway.cancelCalls()).containsExactly(new MockPaymentGateway.CancelCall(
                PAYMENT_KEY, amount, "주문 확정 실패", "compensate-" + orderNumber));
        assertThat(order().getStatus()).isNotEqualTo(TicketingOrder.STATUS_PAID);
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
        // 롤백됐으니 선점·대기열은 그대로
        verify(seatHoldService, never()).release(anyLong(), anyString(), anyList());
        verify(waitingQueue, never()).leave(anyString(), anyLong());
    }

    @Test
    void 실패_API_는_PENDING_을_FAILED_로_하고_선점은_유지() {
        service.fail(EVENT_ID, user.getSeq(), orderNumber, "PAY_PROCESS_CANCELED", "사용자가 결제를 취소했습니다");

        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getStatus()).isEqualTo("FAILED");
        assertThat(payment().getFailCode()).isEqualTo("PAY_PROCESS_CANCELED");
        assertThat(payment().getFailMessage()).isEqualTo("사용자가 결제를 취소했습니다");
        verify(seatHoldService, never()).release(anyLong(), anyString(), anyList());
        verify(waitingQueue, never()).leave(anyString(), anyLong());
    }

    @Test
    void 실패_API_는_이미_끝난_주문이면_무시() {
        service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        service.fail(EVENT_ID, user.getSeq(), orderNumber, "PAY_PROCESS_CANCELED", "취소");

        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_PAID);
        assertThat(payment().getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void 토스가_UNKNOWN_이면_승인_결과를_모르므로_보상취소_후_FAILED() {
        gateway.failNext("UNKNOWN", "해석할 수 없는 응답");

        assertThatThrownBy(() -> service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOfSatisfying(PaymentGatewayException.class,
                        e -> assertThat(e.code()).isEqualTo("UNKNOWN"));

        assertThat(gateway.cancelCalls()).containsExactly(new MockPaymentGateway.CancelCall(
                PAYMENT_KEY, amount, "주문 확정 실패", "compensate-" + orderNumber));
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("UNKNOWN");
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
    }

    @Test
    void 커밋후처리_Redis가_실패해도_판매는_성공으로_응답하고_취소하지_않는다() {
        doThrow(new RuntimeException("redis down")).when(seatHoldService).release(anyLong(), anyString(), anyList());

        var res = service.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        assertThat(res.getOrderNumber()).isEqualTo(orderNumber);
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_PAID);
        assertThat(payment().getStatus()).isEqualTo("COMPLETED");
        assertThat(gateway.cancelCalls()).isEmpty();
    }

    /**
     * 커밋 단계에서 TransactionException(예: 번역 불가 RollbackException → TransactionSystemException)이 나면
     * Spring 은 afterCompletion(STATUS_UNKNOWN) 을 부른다. 첫 커밋 1회만 그렇게 실패시키는 트랜잭션 매니저.
     */
    static class UnknownOutcomeCommitTxManager extends JpaTransactionManager {
        final AtomicBoolean armed = new AtomicBoolean(true);
        final boolean reallyCommit;

        UnknownOutcomeCommitTxManager(EntityManagerFactory emf, boolean reallyCommit) {
            super(emf);
            this.reallyCommit = reallyCommit;
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
            if (!armed.getAndSet(false)) {
                super.doCommit(status);
                return;
            }
            if (reallyCommit) {
                super.doCommit(status);
            } else {
                doRollback(status);
            }
            throw new TransactionSystemException("Could not commit JPA transaction (simulated)");
        }
    }

    private PaymentConfirmService serviceWith(PlatformTransactionManager txManager) {
        return new PaymentConfirmService(orderRepository, paymentRepository, eventSeatRepository,
                seatVersionGenerator, seatHoldService, gateway, ticketingOrderService, txManager);
    }

    @Test
    void 커밋_결과를_모르는데_실제로_롤백됐으면_보상취소_후_FAILED() {
        PaymentConfirmService svc = serviceWith(new UnknownOutcomeCommitTxManager(entityManagerFactory, false));

        assertThatThrownBy(() -> svc.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount))
                .isInstanceOf(TransactionSystemException.class);

        assertThat(gateway.cancelCalls()).containsExactly(new MockPaymentGateway.CancelCall(
                PAYMENT_KEY, amount, "주문 확정 실패", "compensate-" + orderNumber));
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(payment().getFailCode()).isEqualTo("CONFIRM_FAILED");
        assertThat(seatStatuses()).containsOnly(SeatStatus.AVAILABLE);
    }

    @Test
    void 커밋_결과를_모르는데_실제로_커밋됐으면_취소하지_않고_성공() {
        PaymentConfirmService svc = serviceWith(new UnknownOutcomeCommitTxManager(entityManagerFactory, true));

        var res = svc.confirm(EVENT_ID, user.getSeq(), orderNumber, PAYMENT_KEY, amount);

        assertThat(res.getOrderNumber()).isEqualTo(orderNumber);
        assertThat(gateway.cancelCalls()).isEmpty();
        assertThat(order().getStatus()).isEqualTo(TicketingOrder.STATUS_PAID);
        assertThat(payment().getPaymentKey()).isEqualTo(PAYMENT_KEY);
        assertThat(seatStatuses()).containsOnly(SeatStatus.SOLD);
        // afterCommit 이 불리지 않았으니 confirm 이 대신 정리한다
        verify(waitingQueue).leave(EVENT_ID, user.getSeq());
    }
}
