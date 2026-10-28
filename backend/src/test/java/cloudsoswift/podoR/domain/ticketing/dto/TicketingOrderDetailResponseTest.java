package cloudsoswift.podoR.domain.ticketing.dto;

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
        order.cancelItems(List.of(gone), LocalDateTime.of(2026, 10, 24, 12, 0));

        TicketingOrderDetailResponse res = new TicketingOrderDetailResponse(order);

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
}
