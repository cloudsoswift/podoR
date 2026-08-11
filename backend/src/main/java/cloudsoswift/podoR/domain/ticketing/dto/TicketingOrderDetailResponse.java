package cloudsoswift.podoR.domain.ticketing.dto;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

/** 예매 상세: 공연 간략 + 예매 정보 + 좌석 목록. */
@Getter
public class TicketingOrderDetailResponse {
    private final String eventId;
    private final String orderNumber;
    private final LocalDateTime orderedAt;
    private final String status;
    private final LocalDateTime cancelledAt;
    private final Integer totalPrice;
    private final String eventTitle;
    private final String venueName;
    private final LocalDateTime eventDate;
    private final List<Seat> seats;

    public TicketingOrderDetailResponse(TicketingOrder o) {
        this.eventId = o.getEvent().getEventId();
        this.orderNumber = o.getOrderNumber();
        this.orderedAt = o.getOrderedAt();
        this.status = o.getStatus();
        this.cancelledAt = o.getCancelledAt();
        this.totalPrice = o.getTotalPrice();
        this.eventTitle = o.getEvent().getTitle();
        this.venueName = o.getEvent().getVenue().getName();
        this.eventDate = o.getEvent().getEventDate();
        this.seats = o.getItems().stream().map(Seat::new).toList();
    }

    @Getter
    public static class Seat {
        private final String section;
        private final String rowNumber;
        private final Integer seatNumber;
        private final String grade;
        private final Integer price;

        public Seat(TicketingItem item) {
            var es = item.getEventSeat();
            var seat = es.getSeat();
            this.section = seat.getSection();
            this.rowNumber = seat.getRowNumber();
            this.seatNumber = seat.getSeatNumber();
            this.grade = es.getSeatGrade();
            this.price = es.getPrice();
        }
    }
}
