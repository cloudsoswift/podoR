package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.payment.MockPaymentGateway;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CancellationServiceTest {

    static final LocalDateTime SHOW = LocalDateTime.of(2026, 12, 1, 19, 0);
    static final LocalDateTime BEFORE = SHOW.minusDays(1);
    static final LocalDateTime AFTER_DEADLINE = SHOW.minusMinutes(10);

    MockPaymentGateway gateway = new MockPaymentGateway();
    CancellationService service = new CancellationService(
            new DefaultRefundPolicy(new RefundProperties(Duration.ofMinutes(30))), gateway);
    TicketingOrder order;
    TicketingItem a;
    TicketingItem b;
    Payment payment;

    @BeforeEach
    void setUp() {
        Event event = mock(Event.class);
        when(event.getEventDate()).thenReturn(SHOW);
        order = TicketingOrder.builder().event(event).orderNumber("O1").totalPrice(30000).status("PAID").build();
        a = item(1, 10000);
        b = item(2, 20000);
        ReflectionTestUtils.setField(a, "seq", 11L);
        ReflectionTestUtils.setField(b, "seq", 12L);
        order.addItem(a);
        order.addItem(b);
        payment = Payment.builder().ticketingOrder(order).amount(30000L).method("MOCK").build();
        ReflectionTestUtils.setField(order, "payment", payment);
    }

    private TicketingItem item(int no, int price) {
        return TicketingItem.builder().section("A구역").rowNumber("A").seatNumber(no).seatGrade("VIP").price(price).build();
    }

    @Test
    void 관객_취소는_사유와_환불액을_남기고_결제에_누적한다() {
        int refunded = service.cancel(order, List.of(b), CancelReason.USER, BEFORE);

        assertThat(refunded).isEqualTo(20000);
        assertThat(b.getCancelReason()).isEqualTo(CancelReason.USER);
        assertThat(b.getRefundAmount()).isEqualTo(20000);
        assertThat(order.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(payment.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(payment.getCancelledAmount()).isEqualTo(20000L);
    }

    @Test
    void 마지막_좌석까지_취소하면_결제_CANCELLED() {
        service.cancel(order, List.of(a), CancelReason.USER, BEFORE);
        service.cancel(order, List.of(b), CancelReason.USER, BEFORE);

        assertThat(order.getStatus()).isEqualTo("CANCELLED");
        assertThat(payment.getStatus()).isEqualTo("CANCELLED");
        assertThat(payment.getCancelledAmount()).isEqualTo(30000L);
    }

    @Test
    void 마감_후면_CancellationNotAllowedException_이고_아무것도_바뀌지_않는다() {
        assertThatThrownBy(() -> service.cancel(order, List.of(a), CancelReason.USER, AFTER_DEADLINE))
                .isInstanceOf(CancellationNotAllowedException.class)
                .hasMessage("공연 시작 30분 전부터는 취소할 수 없습니다.");

        assertThat(a.isActive()).isTrue();
        assertThat(order.getStatus()).isEqualTo("PAID");
        assertThat(payment.getCancelledAmount()).isZero();
    }

    @Test
    void 배치변경_취소는_마감_후에도_진행된다() {
        service.cancel(order, List.of(a), CancelReason.VENUE_CHANGE, AFTER_DEADLINE);

        assertThat(a.getCancelReason()).isEqualTo(CancelReason.VENUE_CHANGE);
        assertThat(payment.getCancelledAmount()).isEqualTo(10000L);
    }

    @Test
    void 결제가_없는_주문도_취소된다() {
        ReflectionTestUtils.setField(order, "payment", null);

        service.cancel(order, List.of(a, b), CancelReason.USER, BEFORE);

        assertThat(order.getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void 관객_취소_마감은_정책에_위임한다() {
        assertThat(service.userCancelDeadline(order)).isEqualTo(SHOW.minusMinutes(30));
    }

    // ---- PG 환불 연동 ----

    private void paidWithToss() {
        payment.complete("pk-1", "카드", BEFORE.minusDays(1));
    }

    @Test
    void paymentKey_있으면_환불액과_사유문구로_게이트웨이_취소() {
        paidWithToss();

        service.cancel(order, List.of(b), CancelReason.USER, BEFORE);

        assertThat(gateway.cancelCalls()).singleElement().satisfies(c -> {
            assertThat(c.paymentKey()).isEqualTo("pk-1");
            assertThat(c.cancelAmount()).isEqualTo(20000L);
            assertThat(c.reason()).isEqualTo("관객 취소");
            assertThat(c.idempotencyKey()).isEqualTo(CancellationService.idempotencyKey(order, List.of(b)));
        });
    }

    @Test
    void 배치변경_취소의_사유문구() {
        paidWithToss();

        service.cancel(order, List.of(a), CancelReason.VENUE_CHANGE, AFTER_DEADLINE);

        assertThat(gateway.cancelCalls()).singleElement()
                .satisfies(c -> assertThat(c.reason()).isEqualTo("공연장 사정으로 취소"));
    }

    @Test
    void 같은_대상이면_멱등키가_같다() {
        String k1 = CancellationService.idempotencyKey(order, List.of(a, b));
        String k2 = CancellationService.idempotencyKey(order, List.of(b, a));

        assertThat(k1).isEqualTo(k2).hasSize(64).matches("[0-9a-f]+");
        assertThat(CancellationService.idempotencyKey(order, List.of(a))).isNotEqualTo(k1);
        // SHA-256("O1:11,12")
        assertThat(k1).isEqualTo(sha256Hex("O1:11,12"));
    }

    private static String sha256Hex(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(d);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void 환불액_0_이면_호출_안함() {
        paidWithToss();
        CancellationService zeroRefund = new CancellationService(new RefundPolicy() {
            @Override
            public RefundDecision evaluate(TicketingOrder o, List<TicketingItem> items, CancelReason r, LocalDateTime now) {
                java.util.Map<TicketingItem, Integer> zero = new java.util.LinkedHashMap<>();
                for (TicketingItem i : items) zero.put(i, 0);
                return new RefundDecision(true, null, zero);
            }

            @Override
            public LocalDateTime userCancelDeadline(TicketingOrder o) {
                return SHOW;
            }
        }, gateway);

        zeroRefund.cancel(order, List.of(a), CancelReason.USER, BEFORE);

        assertThat(a.isActive()).isFalse();
        assertThat(gateway.cancelCalls()).isEmpty();
    }

    @Test
    void paymentKey_없으면_호출_안함() {
        service.cancel(order, List.of(a), CancelReason.USER, BEFORE);

        assertThat(a.isActive()).isFalse();
        assertThat(gateway.cancelCalls()).isEmpty();
    }

    @Test
    void 게이트웨이_실패는_예외로_전파() {
        paidWithToss();
        gateway.failNext("PROVIDER_ERROR", "일시적인 오류");

        assertThatThrownBy(() -> service.cancel(order, List.of(a), CancelReason.USER, BEFORE))
                .isInstanceOfSatisfying(PaymentGatewayException.class, e -> {
                    assertThat(e.code()).isEqualTo("PROVIDER_ERROR");
                    assertThat(e.getMessage()).isEqualTo("일시적인 오류");
                });
    }
}
