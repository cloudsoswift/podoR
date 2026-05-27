package cloudsoswift.podoR.domain.venue.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "venue_layout")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VenueLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_seq", nullable = false)
    private Venue venue;

    @Column(columnDefinition = "TEXT")
    private String layoutJson;

    public void update(String layoutJson) {
        this.layoutJson = layoutJson;
    }

    @Builder
    public VenueLayout(Venue venue, String layoutJson) {
        this.venue = venue;
        this.layoutJson = layoutJson;
    }
}
