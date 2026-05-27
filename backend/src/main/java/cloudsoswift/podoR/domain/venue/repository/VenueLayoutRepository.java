package cloudsoswift.podoR.domain.venue.repository;

import cloudsoswift.podoR.domain.venue.entity.VenueLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueLayoutRepository extends JpaRepository<VenueLayout, Long> {
    Optional<VenueLayout> findByVenueSeq(Long venueSeq);
    boolean existsByVenueSeq(Long venueSeq);
}
