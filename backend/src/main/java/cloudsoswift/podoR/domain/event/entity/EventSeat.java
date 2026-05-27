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
                @UniqueConstraint(
                        name = "uk_event_seat",
                        columnNames = {"event_seq", "seat_seq"}
                )
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

    @Column(nullable = false)
    private Boolean status = false;

    @Builder
    public EventSeat(Event event, Seat seat, String seatGrade, Integer price, Boolean status) {
        this.event = event;
        this.seat = seat;
        this.seatGrade = seatGrade;
        this.price = price;
        this.status = status != null ? status : false;
    }

    public void updateStatus(Boolean status) {
        this.status = status;
    }
}
