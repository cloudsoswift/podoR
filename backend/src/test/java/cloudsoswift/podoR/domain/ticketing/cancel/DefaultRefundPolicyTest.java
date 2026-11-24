package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DefaultRefundPolicyTest {

    static final LocalDateTime SHOW = LocalDateTime.of(2026, 12, 1, 19, 0);

    DefaultRefundPolicy policy = new DefaultRefundPolicy(new RefundProperties(Duration.ofMinutes(30)));
    TicketingOrder order;
    TicketingItem a;
    TicketingItem b;
    List<TicketingItem> items;

    @BeforeEach
    void setUp() {
        Event event = mock(Event.class);
        when(event.getEventDate()).thenReturn(SHOW);
        order = TicketingOrder.builder().event(event).orderNumber("O1").totalPrice(30000).status("PAID").build();
        a = TicketingItem.builder().section("A구역").rowNumber("A").seatNumber(1).seatGrade("VIP").price(10000).build();
        b = TicketingItem.builder().section("A구역").rowNumber("A").seatNumber(2).seatGrade("VIP").price(20000).build();
        order.addItem(a);
        order.addItem(b);
        items = List.of(a, b);
    }

    @Test
    void 마감_전_관객_취소는_전액() {
        RefundDecision d = policy.evaluate(order, items, CancelReason.USER, LocalDateTime.of(2026, 12, 1, 18, 29));

        assertThat(d.allowed()).isTrue();
        assertThat(d.refundOf(a)).isEqualTo(10000);
        assertThat(d.refundOf(b)).isEqualTo(20000);
    }

    @Test
    void 마감_정각이면_거절() {
        RefundDecision d = policy.evaluate(order, items, CancelReason.USER, LocalDateTime.of(2026, 12, 1, 18, 30));

        assertThat(d.allowed()).isFalse();
        assertThat(d.deniedMessage()).isEqualTo("공연 시작 30분 전부터는 취소할 수 없습니다.");
    }

    @Test
    void 공연_이후_관객_취소도_거절() {
        RefundDecision d = policy.evaluate(order, items, CancelReason.USER, LocalDateTime.of(2026, 12, 1, 19, 30));

        assertThat(d.allowed()).isFalse();
    }

    @Test
    void 배치변경은_마감과_무관하게_전액() {
        RefundDecision d = policy.evaluate(order, items, CancelReason.VENUE_CHANGE, LocalDateTime.of(2026, 12, 1, 18, 55));

        assertThat(d.allowed()).isTrue();
        assertThat(d.refundOf(a)).isEqualTo(10000);
        assertThat(d.refundOf(b)).isEqualTo(20000);
    }

    @Test
    void 관객_취소_마감_시각() {
        assertThat(policy.userCancelDeadline(order)).isEqualTo(LocalDateTime.of(2026, 12, 1, 18, 30));
    }
}
