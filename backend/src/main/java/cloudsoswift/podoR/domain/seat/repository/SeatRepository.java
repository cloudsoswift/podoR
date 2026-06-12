package cloudsoswift.podoR.domain.seat.repository;

import cloudsoswift.podoR.domain.seat.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long> {
    List<Seat> findByVenueSeq(Long venueSeq);
    void deleteByVenueSeq(Long venueSeq);
    long countByVenueSeq(Long venueSeq);
}
