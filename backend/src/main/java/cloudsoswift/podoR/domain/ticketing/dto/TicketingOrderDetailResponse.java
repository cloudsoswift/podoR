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
    // 관객 취소 마감 시각(환불 정책). 이 시각부터는 관객이 취소할 수 없다.
    private final LocalDateTime cancellableUntil;
    private final Integer totalPrice;
    private final String eventTitle;
    private final String venueName;
    private final LocalDateTime eventDate;
    private final List<Seat> seats;

    public TicketingOrderDetailResponse(TicketingOrder o, LocalDateTime cancellableUntil) {
        this.eventId = o.getEvent().getEventId();
        this.orderNumber = o.getOrderNumber();
        this.orderedAt = o.getOrderedAt();
        this.status = o.getStatus();
        this.cancelledAt = o.getCancelledAt();
        this.cancellableUntil = cancellableUntil;
        this.totalPrice = o.getTotalPrice();
        this.eventTitle = o.getEvent().getTitle();
        this.venueName = o.getEvent().getVenue().getName();
        this.eventDate = o.getEvent().getEventDate();
        this.seats = o.getItems().stream().map(Seat::new).toList();
    }

    /** 좌석 정보는 예매 시점 스냅샷에서 읽는다(회차 좌석이 지워져도 표시). */
    @Getter
    public static class Seat {
        private final Long itemSeq;
        private final String section;
        private final String rowNumber;
        private final Integer seatNumber;
        private final String grade;
        private final Integer price;
        private final String status;          // PAID / CANCELLED
        private final LocalDateTime cancelledAt;
        private final String cancelReason;    // USER / VENUE_CHANGE, 사유 기록 전 취소는 null

        public Seat(TicketingItem item) {
            this.itemSeq = item.getSeq();
            this.section = item.getSection();
            this.rowNumber = item.getRowNumber();
            this.seatNumber = item.getSeatNumber();
            this.grade = item.getSeatGrade();
            this.price = item.getPrice();
            this.status = item.getStatus();
            this.cancelledAt = item.getCancelledAt();
            this.cancelReason = item.getCancelReason() == null ? null : item.getCancelReason().name();
        }
    }
}
