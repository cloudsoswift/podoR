package cloudsoswift.podoR.domain.concerthall.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "concert_hall_layout")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConcertHallLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hall_seq", nullable = false)
    private ConcertHall concertHall;

    @Column(columnDefinition = "TEXT")
    private String layoutJson;

    public void update(String layoutJson) {
        this.layoutJson = layoutJson;
    }

    @Builder
    public ConcertHallLayout(ConcertHall concertHall, String layoutJson) {
        this.concertHall = concertHall;
        this.layoutJson = layoutJson;
    }
}