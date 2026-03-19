package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.performance.entity.PerformanceSeat;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ticketing_item")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticketing_order_seq", nullable = false)
    private TicketingOrder ticketingOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_seat_seq", nullable = false)
    private PerformanceSeat performanceSeat;

    @Builder
    public TicketingItem(TicketingOrder ticketingOrder, PerformanceSeat performanceSeat) {
        this.ticketingOrder = ticketingOrder;
        this.performanceSeat = performanceSeat;
    }

    // 양방향 관계 설정용
    void setTicketingOrder(TicketingOrder ticketingOrder) {
        this.ticketingOrder = ticketingOrder;
    }
}