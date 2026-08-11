package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.EventSeries;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EventSeriesRepository extends JpaRepository<EventSeries, Long> {
    Optional<EventSeries> findBySeriesId(String seriesId);
}
