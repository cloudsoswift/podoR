package cloudsoswift.podoR.domain.seat.entity;

import cloudsoswift.podoR.domain.concerthall.entity.ConcertHall;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "seat",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_seat_location",
                        columnNames = {"hall_seq", "section", "row_number", "seat_number"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hall_seq", nullable = false)
    private ConcertHall concertHall;

    @Column(nullable = false, length = 20)
    private String section;

    @Column(name = "row_number", nullable = false, length = 10)
    private String rowNumber;

    @Column(name = "seat_number")
    private Integer seatNumber;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Builder
    public Seat(ConcertHall concertHall, String section, String rowNumber,
                Integer seatNumber, Boolean isAvailable) {
        this.concertHall = concertHall;
        this.section = section;
        this.rowNumber = rowNumber;
        this.seatNumber = seatNumber;
        this.isAvailable = isAvailable != null ? isAvailable : true;
    }
}