package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
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
    @JoinColumn(name = "event_seq", nullable = false)
    private Event event;

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

    // 낙관적 락: 같은 주문을 동시에 부분 취소(관객 취소 vs 좌석맵 저장 등)하면 나중 커밋이 실패한다.
    // 결제 취소액도 주문과 같은 트랜잭션에서만 바뀌므로 이 버전 하나로 함께 보호된다.
    // 초기값을 두지 않는다: Spring Data 는 version 이 null 이어야 새 엔티티로 보고 persist 한다
    // (값이 있으면 merge 해서 원본 객체가 영속화되지 않는다). 저장 시 Hibernate 가 0 을 넣는다.
    @Version
    @Column(nullable = false)
    private Long version;

    @OneToMany(mappedBy = "ticketingOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TicketingItem> items = new ArrayList<>();

    @OneToOne(mappedBy = "ticketingOrder", fetch = FetchType.LAZY)
    private Payment payment;

    @PrePersist
    protected void onCreate() {
        orderedAt = LocalDateTime.now();
    }

    @Builder
    public TicketingOrder(Event event, User user, String orderNumber,
                          Integer totalPrice, String status) {
        this.event = event;
        this.user = user;
        this.orderNumber = orderNumber;
        this.totalPrice = totalPrice;
        this.status = status;
    }

    public static final String STATUS_PAID = "PAID";
    public static final String STATUS_PARTIALLY_CANCELLED = "PARTIALLY_CANCELLED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    /** 취소되지 않은 항목. */
    public List<TicketingItem> activeItems() {
        return items.stream().filter(TicketingItem::isActive).toList();
    }

    /** 남은 좌석이 있는 결제 완료 주문만 취소할 수 있다. */
    public boolean isCancellable() {
        return STATUS_PAID.equals(status) || STATUS_PARTIALLY_CANCELLED.equals(status);
    }

    /**
     * 항목 단위 부분 취소. 총액은 남은 항목 금액 합으로, 상태는 남은 항목 유무로 맞춘다.
     * 이 주문의 활성 항목이 아닌 것이 섞이면 아무것도 바꾸지 않고 400.
     * 회차 좌석 상태 복구와 결제 취소액 반영은 호출부 책임이다.
     *
     * @return 이번에 취소한 금액 합
     */
    public int cancelItems(Collection<TicketingItem> targets, LocalDateTime at) {
        if (!isCancellable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "취소할 수 없는 주문입니다.");
        }
        for (TicketingItem t : targets) {
            if (t.getTicketingOrder() != this || !t.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "취소할 수 없는 좌석이 포함되어 있습니다.");
            }
        }
        int cancelled = 0;
        for (TicketingItem t : new LinkedHashSet<>(targets)) {
            t.markCancelled(at);
            cancelled += t.getPrice();
        }
        List<TicketingItem> remaining = activeItems();
        this.totalPrice = remaining.stream().mapToInt(TicketingItem::getPrice).sum();
        if (remaining.isEmpty()) {
            this.status = STATUS_CANCELLED;
            this.cancelledAt = at;
        } else {
            this.status = STATUS_PARTIALLY_CANCELLED;
        }
        return cancelled;
    }

    // 현재 주문에 새 아이템 추가
    public void addItem(TicketingItem item) {
        this.items.add(item);
        item.setTicketingOrder(this);
    }
}