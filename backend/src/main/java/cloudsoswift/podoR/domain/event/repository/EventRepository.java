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

    // 특정 공연장에 연결된 활성(미삭제) 이벤트 존재 여부 — Venue 삭제 가드용
    boolean existsByVenue_SeqAndDeletedDateIsNull(Long venueSeq);
}
