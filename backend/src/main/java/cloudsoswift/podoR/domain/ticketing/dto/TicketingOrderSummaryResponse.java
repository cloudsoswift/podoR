package cloudsoswift.podoR.domain.ticketing.dto;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import lombok.Getter;

import java.time.LocalDateTime;

/** 예매내역 목록 카드. */
@Getter
public class TicketingOrderSummaryResponse {
    private final String eventId;
    private final String orderNumber;
    private final String eventTitle;
    private final String venueName;
    private final LocalDateTime eventDate;
    private final LocalDateTime orderedAt;
    private final String status;
    private final Integer totalPrice;
    private final int seatCount;

    public TicketingOrderSummaryResponse(TicketingOrder o) {
        this.eventId = o.getEvent().getEventId();
        this.orderNumber = o.getOrderNumber();
        this.eventTitle = o.getEvent().getTitle();
        this.venueName = o.getEvent().getVenue().getName();
        this.eventDate = o.getEvent().getEventDate();
        this.orderedAt = o.getOrderedAt();
        this.status = o.getStatus();
        this.totalPrice = o.getTotalPrice();
        // 부분 취소된 주문은 남은 좌석만, 전부 취소된 주문은 원래 좌석 수를 보여 준다.
        this.seatCount = o.activeItems().isEmpty() ? o.getItems().size() : o.activeItems().size();
    }
}
