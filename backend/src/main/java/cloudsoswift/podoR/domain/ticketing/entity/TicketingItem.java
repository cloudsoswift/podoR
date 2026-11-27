package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ticketing_item")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketingItem {

    public static final String STATUS_PAID = "PAID";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticketing_order_seq", nullable = false)
    private TicketingOrder ticketingOrder;

    // 공연장 배치 변경으로 회차 좌석이 지워지면 null 이 된다. 좌석 정보는 아래 스냅샷에 남는다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_seat_seq")
    private EventSeat eventSeat;

    // 예매 시점 좌석 스냅샷
    @Column(nullable = false, length = 20)
    private String section;

    @Column(name = "row_number", nullable = false, length = 10)
    private String rowNumber;

    @Column(name = "seat_number")
    private Integer seatNumber;

    @Column(name = "seat_grade", nullable = false, length = 10)
    private String seatGrade;

    @Column(nullable = false)
    private Integer price;

    @Column(nullable = false, length = 20)
    private String status = STATUS_PAID;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    // 취소 사유와 실제 환불액. 이 컬럼이 생기기 전에 취소된 항목은 null.
    @Enumerated(EnumType.STRING)
    @Column(name = "cancel_reason", length = 20)
    private CancelReason cancelReason;

    // 환불 정책(수수료 등)에 따라 좌석가(price)보다 적을 수 있다.
    @Column(name = "refund_amount")
    private Integer refundAmount;

    @Builder
    public TicketingItem(TicketingOrder ticketingOrder, EventSeat eventSeat, String section, String rowNumber,
                         Integer seatNumber, String seatGrade, Integer price) {
        this.ticketingOrder = ticketingOrder;
        this.eventSeat = eventSeat;
        this.section = section;
        this.rowNumber = rowNumber;
        this.seatNumber = seatNumber;
        this.seatGrade = seatGrade;
        this.price = price;
        this.status = STATUS_PAID;
    }

    /** 회차 좌석에서 좌석 정보를 복사한 항목. */
    public static TicketingItem of(EventSeat eventSeat) {
        Seat seat = eventSeat.getSeat();
        return TicketingItem.builder()
                .eventSeat(eventSeat)
                .section(seat.getSection())
                .rowNumber(seat.getRowNumber())
                .seatNumber(seat.getSeatNumber())
                .seatGrade(eventSeat.getSeatGrade())
                .price(eventSeat.getPrice())
                .build();
    }

    public boolean isActive() {
        return STATUS_PAID.equals(status);
    }

    /** PENDING 항목의 상태 전이(결제 승인/실패/만료). 주문이 상태 검증을 맡는다. */
    void changeStatus(String status) {
        this.status = status;
    }

    void markCancelled(LocalDateTime at, CancelReason reason, int refundAmount) {
        this.status = STATUS_CANCELLED;
        this.cancelledAt = at;
        this.cancelReason = reason;
        this.refundAmount = refundAmount;
    }

    /** 회차 좌석과의 연결을 끊는다(좌석 정보는 스냅샷으로 남는다). */
    public void detachEventSeat() {
        this.eventSeat = null;
    }

    // 양방향 관계 설정용
    void setTicketingOrder(TicketingOrder ticketingOrder) {
        this.ticketingOrder = ticketingOrder;
    }
}
