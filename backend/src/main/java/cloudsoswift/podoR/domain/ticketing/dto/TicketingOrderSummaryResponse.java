package cloudsoswift.podoR.domain.ticketing.dto;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import lombok.Getter;

import java.time.LocalDateTime;

/** 예매내역 목록 카드. */
@Getter
public class TicketingOrderSummaryResponse {
    private final String orderNumber;
    private final String eventTitle;
    private final String venueName;
    private final LocalDateTime eventDate;
    private final LocalDateTime orderedAt;
    private final String status;
    private final Integer totalPrice;
    private final int seatCount;

    public TicketingOrderSummaryResponse(TicketingOrder o) {
        this.orderNumber = o.getOrderNumber();
        this.eventTitle = o.getEvent().getTitle();
        this.venueName = o.getEvent().getVenue().getName();
        this.eventDate = o.getEvent().getEventDate();
        this.orderedAt = o.getOrderedAt();
        this.status = o.getStatus();
        this.totalPrice = o.getTotalPrice();
        this.seatCount = o.getItems().size();
    }
}
