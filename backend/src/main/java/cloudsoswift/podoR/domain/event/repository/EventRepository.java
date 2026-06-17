package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {
    Optional<Event> findByEventIdAndDeletedDateIsNull(String eventId);
    Page<Event> findAllByDeletedDateIsNull(Pageable pageable);
    boolean existsByEventIdAndHost_SeqAndDeletedDateIsNull(String eventId, Long hostSeq);

    // 특정 공연장에 연결된 활성(미삭제) 이벤트 존재 여부 — Venue 삭제 가드용
    boolean existsByVenue_SeqAndDeletedDateIsNull(Long venueSeq);

    // Admin: 미삭제 이벤트 제목 검색(부분일치). keyword 는 non-null 전제.
    @Query("SELECT e FROM Event e WHERE e.deletedDate IS NULL AND " +
            "LOWER(e.title) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<Event> searchActiveEvents(@Param("keyword") String keyword, Pageable pageable);
}
