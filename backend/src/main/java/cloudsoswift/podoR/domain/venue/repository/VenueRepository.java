package cloudsoswift.podoR.domain.venue.repository;

import cloudsoswift.podoR.domain.venue.entity.Venue;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VenueRepository extends JpaRepository<Venue, Long> {
}
