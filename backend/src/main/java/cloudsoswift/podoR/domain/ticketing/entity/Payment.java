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

    // 토스 paymentKey. V1 의 pg_transaction_id 컬럼에 저장한다.
    @Column(name = "pg_transaction_id", length = 255)
    private String paymentKey;

    @Column(name = "fail_code", length = 50)
    private String failCode;

    @Column(name = "fail_message", length = 500)
    private String failMessage;

    @Builder
    public Payment(TicketingOrder ticketingOrder, String method, Long amount) {
        this.ticketingOrder = ticketingOrder;
        this.method = method;
        this.amount = amount;
        this.status = "COMPLETED";
        this.cancelledAmount = 0L;
        this.paidAt = LocalDateTime.now();
    }

    /** 결제 승인 대기 상태. 승인 전이라 paidAt 이 없다. */
    public static Payment ready(TicketingOrder order, long amount) {
        Payment p = new Payment();
        p.ticketingOrder = order;
        p.amount = amount;
        p.status = "READY";
        p.cancelledAmount = 0L;
        return p;
    }

    public void complete(String paymentKey, String method, LocalDateTime at) {
        this.paymentKey = paymentKey;
        this.method = method;
        this.status = "COMPLETED";
        this.paidAt = at;
    }

    public void fail(String code, String message) {
        this.status = "FAILED";
        this.failCode = code;
        this.failMessage = message;
    }

    public void expire() {
        this.status = "EXPIRED";
    }

    /**
     * 환불 금액을 누적한다. 주문에 남은 좌석이 없으면(fullyCancelled) CANCELLED, 아니면 PARTIALLY_CANCELLED.
     * 수수료·할인이 있으면 누적 환불액이 원금과 다르므로 금액으로 판정하지 않는다.
     */
    public void cancelAmount(long refunded, LocalDateTime at, boolean fullyCancelled) {
        this.cancelledAmount += refunded;
        if (fullyCancelled) {
            this.status = "CANCELLED";
            this.cancelledAt = at;
        } else {
            this.status = "PARTIALLY_CANCELLED";
        }
    }
}
