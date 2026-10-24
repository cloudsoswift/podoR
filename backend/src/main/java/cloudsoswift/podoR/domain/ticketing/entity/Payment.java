package cloudsoswift.podoR.domain.ticketing.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment",
        uniqueConstraints = @UniqueConstraint(name = "uk_payment_order", columnNames = "ticketing_order_seq"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticketing_order_seq", nullable = false)
    private TicketingOrder ticketingOrder;

    @Column(name = "payment_method", length = 50)
    private String method;

    @Column(name = "payment_status", nullable = false, length = 50)
    private String status;   // COMPLETED / PARTIALLY_CANCELLED / CANCELLED

    @Column(name = "payment_amount", nullable = false)
    private Long amount;

    // 누적 취소(환불) 금액. amount 는 결제 원금으로 유지한다.
    @Column(name = "cancelled_amount", nullable = false)
    private Long cancelledAmount = 0L;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Builder
    public Payment(TicketingOrder ticketingOrder, String method, Long amount) {
        this.ticketingOrder = ticketingOrder;
        this.method = method;
        this.amount = amount;
        this.status = "COMPLETED";
        this.cancelledAmount = 0L;
        this.paidAt = LocalDateTime.now();
    }

    /** 취소(환불) 금액을 누적한다. 원금까지 취소되면 CANCELLED, 아니면 PARTIALLY_CANCELLED. */
    public void cancelAmount(long cancelled, LocalDateTime at) {
        this.cancelledAmount += cancelled;
        if (this.cancelledAmount >= this.amount) {
            this.status = "CANCELLED";
            this.cancelledAt = at;
        } else {
            this.status = "PARTIALLY_CANCELLED";
        }
    }
}
