package cloudsoswift.podoR.domain.concerthall.repository;

import cloudsoswift.podoR.domain.concerthall.entity.ConcertHallLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ConcertHallLayoutRepository extends JpaRepository<ConcertHallLayout, Long> {
    Optional<ConcertHallLayout> findByConcertHallSeq(Long hallSeq);
    boolean existsByConcertHallSeq(Long hallSeq);
}
