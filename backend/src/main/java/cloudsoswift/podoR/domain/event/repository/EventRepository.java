package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {
    Optional<Event> findByEventIdAndDeletedDateIsNull(String eventId);
    Page<Event> findAllByDeletedDateIsNull(Pageable pageable);
    boolean existsByEventIdAndHost_SeqAndDeletedDateIsNull(String eventId, Long hostSeq);
}
