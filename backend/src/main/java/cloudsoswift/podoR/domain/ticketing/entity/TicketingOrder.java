package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.performance.entity.Performance;
import cloudsoswift.podoR.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ticketing_order")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketingOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_seq", nullable = false)
    private Performance performance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_seq", nullable = false)
    private User user;

    @Column(name = "order_number", nullable = false, unique = true, length = 100)
    @Comment("UNIQUE")
    private String orderNumber;

    @Column(name = "total_price", nullable = false)
    private Integer totalPrice;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "ordered_at", nullable = false, updatable = false)
    private LocalDateTime orderedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @OneToMany(mappedBy = "ticketingOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TicketingItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        orderedAt = LocalDateTime.now();
    }

    @Builder
    public TicketingOrder(Performance performance, User user, String orderNumber,
                          Integer totalPrice, String status) {
        this.performance = performance;
        this.user = user;
        this.orderNumber = orderNumber;
        this.totalPrice = totalPrice;
        this.status = status;
    }

    public void cancel() {
        this.status = "CANCELLED";
        this.cancelledAt = LocalDateTime.now();
    }

    // 현재 주문에 새 아이템 추가
    public void addItem(TicketingItem item) {
        this.items.add(item);
        item.setTicketingOrder(this);
    }
}