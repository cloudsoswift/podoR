package cloudsoswift.podoR.domain.ticketing.dto;

import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TicketingOrderDetailResponseTest {

    static final LocalDateTime DEADLINE = LocalDateTime.of(2026, 12, 1, 18, 30);

    @Test
    void 회차좌석이_끊긴_항목도_스냅샷으로_표시() {
        Event event = mock(Event.class);
        when(event.getVenue()).thenReturn(Venue.builder().name("v").address("a").build());
        Seat seat = Seat.builder().section("A구역").sectionKey("k").rowNumber("B").seatNumber(7).build();
        EventSeat es = EventSeat.builder().seat(seat).seatGrade("VIP").price(15000).changeVersion(0L).build();
        TicketingOrder order = TicketingOrder.builder().event(event).orderNumber("O1").totalPrice(30000).status("PAID").build();
        TicketingItem kept = TicketingItem.of(es);
        TicketingItem gone = TicketingItem.of(es);
        ReflectionTestUtils.setField(kept, "seq", 1L);
        ReflectionTestUtils.setField(gone, "seq", 2L);
        order.addItem(kept);
        order.addItem(gone);
        gone.detachEventSeat();
        order.cancelItems(List.of(gone), CancelReason.VENUE_CHANGE, TicketingItem::getPrice, LocalDateTime.of(2026, 10, 24, 12, 0));

        TicketingOrderDetailResponse res = new TicketingOrderDetailResponse(order, DEADLINE);

        TicketingOrderDetailResponse.Seat s = res.getSeats().get(1);
        assertThat(s.getItemSeq()).isEqualTo(2L);
        assertThat(s.getSection()).isEqualTo("A구역");
        assertThat(s.getRowNumber()).isEqualTo("B");
        assertThat(s.getSeatNumber()).isEqualTo(7);
        assertThat(s.getGrade()).isEqualTo("VIP");
        assertThat(s.getPrice()).isEqualTo(15000);
        assertThat(s.getStatus()).isEqualTo("CANCELLED");
        assertThat(s.getCancelledAt()).isEqualTo(LocalDateTime.of(2026, 10, 24, 12, 0));
        assertThat(res.getSeats().get(0).getStatus()).isEqualTo("PAID");
    }

    @Test
    void 좌석에_취소_사유와_주문에_취소_마감을_담는다() {
        TicketingOrder order = order();
        TicketingItem kept = item(order, 1L);
        TicketingItem gone = item(order, 2L);
        order.cancelItems(List.of(gone), CancelReason.VENUE_CHANGE, TicketingItem::getPrice, LocalDateTime.of(2026, 10, 24, 12, 0));

        TicketingOrderDetailResponse res = new TicketingOrderDetailResponse(order, DEADLINE);

        assertThat(res.getCancellableUntil()).isEqualTo(DEADLINE);
        assertThat(res.getSeats().get(1).getCancelReason()).isEqualTo("VENUE_CHANGE");
        assertThat(res.getSeats().get(0).getCancelReason()).isNull();
    }

    @Test
    void 사유가_없는_취소_좌석은_null() {
        TicketingOrder order = order();
        TicketingItem old = item(order, 1L);
        // 사유 컬럼이 생기기 전에 취소된 행
        ReflectionTestUtils.setField(old, "status", TicketingItem.STATUS_CANCELLED);
        ReflectionTestUtils.setField(old, "cancelledAt", LocalDateTime.of(2026, 1, 1, 0, 0));

        TicketingOrderDetailResponse res = new TicketingOrderDetailResponse(order, DEADLINE);

        assertThat(res.getSeats().get(0).getStatus()).isEqualTo("CANCELLED");
        assertThat(res.getSeats().get(0).getCancelReason()).isNull();
    }

    private TicketingOrder order() {
        Event event = mock(Event.class);
        when(event.getVenue()).thenReturn(Venue.builder().name("v").address("a").build());
        return TicketingOrder.builder().event(event).orderNumber("O1").totalPrice(30000).status("PAID").build();
    }

    private TicketingItem item(TicketingOrder order, long seq) {
        TicketingItem i = TicketingItem.builder().section("A구역").rowNumber("A").seatNumber((int) seq)
                .seatGrade("VIP").price(15000).build();
        ReflectionTestUtils.setField(i, "seq", seq);
        order.addItem(i);
        return i;
    }
}
