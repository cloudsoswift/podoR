package cloudsoswift.podoR.domain.seat.entity;

import cloudsoswift.podoR.domain.venue.entity.Venue;
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
                        columnNames = {"venue_seq", "section_key", "row_number", "seat_number"}
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
    @JoinColumn(name = "venue_seq", nullable = false)
    private Venue venue;

    // 표시용 섹션 이름. 이름을 바꿔도 좌석 정체성(section_key)은 그대로다.
    @Column(nullable = false, length = 20)
    private String section;

    // layoutJson 의 섹션 id. 좌석 정체성 = (venue, section_key, row_number, seat_number).
    // 이 컬럼이 생기기 전 좌석은 null 이며, 좌석맵 저장 시 섹션 이름으로 채운다.
    @Column(name = "section_key", length = 64)
    private String sectionKey;

    @Column(name = "row_number", nullable = false, length = 10)
    private String rowNumber;

    @Column(name = "seat_number")
    private Integer seatNumber;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Builder
    public Seat(Venue venue, String section, String sectionKey, String rowNumber,
                Integer seatNumber, Boolean isAvailable) {
        this.venue = venue;
        this.section = section;
        this.sectionKey = sectionKey;
        this.rowNumber = rowNumber;
        this.seatNumber = seatNumber;
        this.isAvailable = isAvailable != null ? isAvailable : true;
    }

    /** 섹션 이름 변경(표시용). */
    public void rename(String section) {
        this.section = section;
    }

    /** section_key 가 없던 기존 좌석에 키를 채운다. */
    public void assignSectionKey(String sectionKey) {
        this.sectionKey = sectionKey;
    }

    public void changeAvailability(boolean available) {
        this.isAvailable = available;
    }
}
