package cloudsoswift.podoR.domain.event.entity;

import cloudsoswift.podoR.domain.seat.entity.Seat;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "event_seat",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_event_seat", columnNames = {"event_seq", "seat_seq"})
        },
        indexes = {
                @Index(name = "ix_event_seat_change", columnList = "event_seq, change_version")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EventSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_seq", nullable = false)
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_seq", nullable = false)
    private Seat seat;

    @Column(name = "seat_grade", nullable = false, length = 10)
    private String seatGrade;

    @Column(nullable = false)
    private Integer price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SeatStatus status = SeatStatus.AVAILABLE;

    @Column(name = "change_version", nullable = false)
    private Long changeVersion;

    @Builder
    public EventSeat(Event event, Seat seat, String seatGrade, Integer price,
                     SeatStatus status, Long changeVersion) {
        this.event = event;
        this.seat = seat;
        this.seatGrade = seatGrade;
        this.price = price;
        this.status = status != null ? status : SeatStatus.AVAILABLE;
        this.changeVersion = changeVersion;
    }

    /** 등급/가격 변경(재편집 diff). changeVersion 은 호출부에서 새 값으로 갱신. */
    public void updatePricing(String seatGrade, Integer price, Long changeVersion) {
        this.seatGrade = seatGrade;
        this.price = price;
        this.changeVersion = changeVersion;
    }

    /** 판매 상태 변경(Phase 2). changeVersion 은 호출부에서 새 값으로 갱신. */
    public void updateStatus(SeatStatus status, Long changeVersion) {
        this.status = status;
        this.changeVersion = changeVersion;
    }
}
