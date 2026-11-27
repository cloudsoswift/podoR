package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketingOrderTest {

    static final LocalDateTime AT = LocalDateTime.of(2026, 10, 24, 12, 0);

    private TicketingItem item(int price) {
        return TicketingItem.builder()
                .section("A구역").rowNumber("A").seatNumber(price / 10000)
                .seatGrade("VIP").price(price).build();
    }

    private TicketingOrder order(TicketingItem... items) {
        int total = 0;
        for (TicketingItem i : items) total += i.getPrice();
        TicketingOrder o = TicketingOrder.builder().orderNumber("O1").totalPrice(total).status("PAID").build();
        for (TicketingItem i : items) o.addItem(i);
        return o;
    }

    @Test
    void 일부_항목_취소시_PARTIALLY_CANCELLED_와_남은_금액() {
        TicketingItem a = item(10000), b = item(20000), c = item(30000);
        TicketingOrder o = order(a, b, c);

        int cancelled = o.cancelItems(List.of(b), CancelReason.USER, TicketingItem::getPrice, AT);

        assertThat(cancelled).isEqualTo(20000);
        assertThat(o.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(o.getTotalPrice()).isEqualTo(40000);
        assertThat(o.getCancelledAt()).isNull();
        assertThat(b.isActive()).isFalse();
        assertThat(b.getCancelledAt()).isEqualTo(AT);
        assertThat(o.activeItems()).containsExactly(a, c);
        assertThat(o.isCancellable()).isTrue();
    }

    @Test
    void 남은_항목을_모두_취소하면_CANCELLED() {
        TicketingItem a = item(10000), b = item(20000), c = item(30000);
        TicketingOrder o = order(a, b, c);
        o.cancelItems(List.of(b), CancelReason.USER, TicketingItem::getPrice, AT);

        o.cancelItems(List.of(a, c), CancelReason.USER, TicketingItem::getPrice, AT.plusHours(1));

        assertThat(o.getStatus()).isEqualTo("CANCELLED");
        assertThat(o.getTotalPrice()).isZero();
        assertThat(o.getCancelledAt()).isEqualTo(AT.plusHours(1));
        assertThat(o.isCancellable()).isFalse();
    }

    @Test
    void 이미_취소된_항목이나_다른_주문_항목이면_400() {
        TicketingItem a = item(10000), b = item(20000);
        TicketingOrder o = order(a, b);
        o.cancelItems(List.of(a), CancelReason.USER, TicketingItem::getPrice, AT);
        TicketingItem other = item(30000);
        order(other);

        assertThatThrownBy(() -> o.cancelItems(List.of(a), CancelReason.USER, TicketingItem::getPrice, AT))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        assertThatThrownBy(() -> o.cancelItems(List.of(other), CancelReason.USER, TicketingItem::getPrice, AT))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        assertThat(o.getTotalPrice()).isEqualTo(20000); // 실패한 요청은 아무것도 바꾸지 않는다
    }

    @Test
    void 취소한_항목에_사유와_환불액을_남기고_환불액_합을_돌려준다() {
        TicketingItem a = item(10000), b = item(20000);
        TicketingOrder o = order(a, b);

        int refunded = o.cancelItems(List.of(b), CancelReason.USER, i -> i.getPrice() - 2000, AT);

        assertThat(refunded).isEqualTo(18000);
        assertThat(b.getCancelReason()).isEqualTo(CancelReason.USER);
        assertThat(b.getRefundAmount()).isEqualTo(18000);
        assertThat(a.getCancelReason()).isNull();
        assertThat(a.getRefundAmount()).isNull();
        assertThat(o.getTotalPrice()).isEqualTo(10000); // 총액은 남은 좌석가 합 그대로
    }

    @Test
    void 결제_부분취소_누적() {
        Payment p = Payment.builder().amount(60000L).method("MOCK").build();

        p.cancelAmount(20000, AT, false);
        assertThat(p.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(p.getCancelledAmount()).isEqualTo(20000L);
        assertThat(p.getCancelledAt()).isNull();

        p.cancelAmount(40000, AT, true);
        assertThat(p.getStatus()).isEqualTo("CANCELLED");
        assertThat(p.getCancelledAmount()).isEqualTo(60000L);
        assertThat(p.getCancelledAt()).isEqualTo(AT);
    }

    @Test
    void 남은_좌석이_없으면_환불액과_무관하게_CANCELLED() {
        Payment p = Payment.builder().amount(30000L).method("MOCK").build();

        p.cancelAmount(27000L, AT, true);

        assertThat(p.getStatus()).isEqualTo("CANCELLED");
        assertThat(p.getCancelledAmount()).isEqualTo(27000L);
        assertThat(p.getCancelledAt()).isEqualTo(AT);
    }

    @Test
    void 남은_좌석이_있으면_원금만큼_환불돼도_PARTIALLY_CANCELLED() {
        Payment p = Payment.builder().amount(30000L).method("MOCK").build();

        p.cancelAmount(30000L, AT, false);

        assertThat(p.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(p.getCancelledAt()).isNull();
    }

    private EventSeat eventSeat(long seq, int price) {
        Seat seat = Seat.builder().section("A구역").rowNumber("A").seatNumber((int) seq).build();
        EventSeat es = EventSeat.builder().seat(seat).seatGrade("VIP").price(price).build();
        ReflectionTestUtils.setField(es, "seq", seq);
        return es;
    }

    private TicketingOrder pendingOrder() {
        return TicketingOrder.pending(null, null, "P1", List.of(eventSeat(1, 10000), eventSeat(2, 20000)));
    }

    @Test
    void pending_주문은_항목도_PENDING_이고_합계를_계산한다() {
        TicketingOrder o = pendingOrder();

        assertThat(o.getStatus()).isEqualTo("PENDING");
        assertThat(o.isPending()).isTrue();
        assertThat(o.getTotalPrice()).isEqualTo(30000);
        assertThat(o.getOrderedAt()).isNotNull();
        assertThat(o.getItems()).extracting(TicketingItem::getStatus).containsOnly("PENDING");
        assertThat(o.eventSeatSeqs()).containsExactly(1L, 2L);
    }

    @Test
    void markPaid_는_주문과_항목을_PAID_로() {
        TicketingOrder o = pendingOrder();
        o.markPaid();
        assertThat(o.getStatus()).isEqualTo("PAID");
        assertThat(o.getItems()).extracting(TicketingItem::getStatus).containsOnly("PAID");
        assertThat(o.isCancellable()).isTrue();
    }

    @Test
    void PENDING_이_아니면_markPaid_는_예외() {
        TicketingOrder o = pendingOrder();
        o.markFailed();
        assertThatThrownBy(o::markPaid).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void markFailed_는_PENDING_에서만_항목까지() {
        TicketingOrder o = pendingOrder();
        o.markFailed();
        assertThat(o.getStatus()).isEqualTo("FAILED");
        assertThat(o.getItems()).extracting(TicketingItem::getStatus).containsOnly("FAILED");
        assertThatThrownBy(o::markFailed).isInstanceOf(IllegalStateException.class);

        TicketingOrder e = pendingOrder();
        e.markExpired();
        assertThat(e.getStatus()).isEqualTo("EXPIRED");
        assertThat(e.getItems()).extracting(TicketingItem::getStatus).containsOnly("EXPIRED");
    }
}
