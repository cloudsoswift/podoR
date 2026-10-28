package cloudsoswift.podoR.domain.ticketing.dto;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TicketingOrderSummaryResponseTest {

    private TicketingItem item() {
        return TicketingItem.builder().section("A").rowNumber("A").seatNumber(1).seatGrade("VIP").price(10000).build();
    }

    private TicketingOrder order(TicketingItem... items) {
        Event event = mock(Event.class);
        when(event.getVenue()).thenReturn(Venue.builder().name("v").address("a").build());
        TicketingOrder o = TicketingOrder.builder().event(event).orderNumber("O1")
                .totalPrice(10000 * items.length).status("PAID").build();
        for (TicketingItem i : items) o.addItem(i);
        return o;
    }

    @Test
    void 부분취소_주문의_좌석수는_남은_좌석만() {
        TicketingItem a = item(), b = item();
        TicketingOrder o = order(a, b);
        o.cancelItems(List.of(b), LocalDateTime.now());

        assertThat(new TicketingOrderSummaryResponse(o).getSeatCount()).isEqualTo(1);
    }

    @Test
    void 전체취소_주문은_원래_좌석수() {
        TicketingItem a = item(), b = item();
        TicketingOrder o = order(a, b);
        o.cancelItems(List.of(a, b), LocalDateTime.now());

        assertThat(new TicketingOrderSummaryResponse(o).getSeatCount()).isEqualTo(2);
    }
}
