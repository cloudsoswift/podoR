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
    private String status;   // COMPLETED / CANCELLED

    @Column(name = "payment_amount", nullable = false)
    private Long amount;

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
        this.paidAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = "CANCELLED";
        this.cancelledAt = LocalDateTime.now();
    }
}
