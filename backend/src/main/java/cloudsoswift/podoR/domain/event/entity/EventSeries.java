package cloudsoswift.podoR.domain.event.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "event_series",
        uniqueConstraints = @UniqueConstraint(name = "uk_event_series_series_id", columnNames = "series_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EventSeries {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @Column(name = "series_id", nullable = false, length = 255)
    private String seriesId;

    @Column(name = "max_seats_per_person", nullable = false)
    private Integer maxSeatsPerPerson;

    @Builder
    public EventSeries(String seriesId, Integer maxSeatsPerPerson) {
        this.seriesId = seriesId;
        this.maxSeatsPerPerson = maxSeatsPerPerson;
    }

    public void updateMaxSeatsPerPerson(Integer maxSeatsPerPerson) {
        this.maxSeatsPerPerson = maxSeatsPerPerson;
    }
}
