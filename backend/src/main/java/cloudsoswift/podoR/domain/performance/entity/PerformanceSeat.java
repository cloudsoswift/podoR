package cloudsoswift.podoR.domain.performance.entity;

import cloudsoswift.podoR.domain.seat.entity.Seat;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "performance_seat",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_performance_seat",
                        columnNames = {"performance_seq", "seat_seq"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_seq", nullable = false)
    private Performance performance;

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
    public PerformanceSeat(Performance performance, Seat seat,
                           String seatGrade, Integer price, Boolean status) {
        this.performance = performance;
        this.seat = seat;
        this.seatGrade = seatGrade;
        this.price = price;
        this.status = status != null ? status : false;
    }

    public void updateStatus(Boolean status) {
        this.status = status;
    }
}