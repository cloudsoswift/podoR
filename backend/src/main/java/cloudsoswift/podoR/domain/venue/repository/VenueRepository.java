package cloudsoswift.podoR.domain.venue.repository;

import cloudsoswift.podoR.domain.venue.entity.Venue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {

    // soft delete: 삭제되지 않은 공연장만
    Page<Venue> findAllByDeletedAtIsNull(Pageable pageable);

    Optional<Venue> findBySeqAndDeletedAtIsNull(Long seq);
}
