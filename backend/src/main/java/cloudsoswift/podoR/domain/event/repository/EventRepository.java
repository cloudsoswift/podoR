package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.dto.ConcertSummaryResponse;
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

    // 같은 공연(series)의 회차 목록(이른 순)
    java.util.List<Event> findAllBySeriesIdAndDeletedDateIsNullOrderByEventDateAsc(String seriesId);
    boolean existsByEventIdAndHost_SeqAndDeletedDateIsNull(String eventId, Long hostSeq);

    // 특정 공연장에 연결된 활성(미삭제) 이벤트 존재 여부 — Venue 삭제 가드용
    boolean existsByVenue_SeqAndDeletedDateIsNull(Long venueSeq);

    // Admin: 미삭제 이벤트 제목 검색(부분일치). keyword 는 non-null 전제.
    @Query("SELECT e FROM Event e WHERE e.deletedDate IS NULL AND " +
            "LOWER(e.title) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<Event> searchActiveEvents(@Param("keyword") String keyword, Pageable pageable);

    // 공연 목록: series_id 그룹의 대표(가장 이른 회차) 1건 + 회차 수
    @Query("SELECT new cloudsoswift.podoR.domain.event.dto.ConcertSummaryResponse(" +
            " e.seriesId, e.eventId, e.title, e.eventType, e.venue.name, e.eventDate, " +
            " (SELECT COUNT(e3) FROM Event e3 WHERE e3.seriesId = e.seriesId AND e3.deletedDate IS NULL)) " +
            "FROM Event e " +
            "WHERE e.deletedDate IS NULL " +
            "AND e.eventDate = (SELECT MIN(e2.eventDate) FROM Event e2 " +
            "                   WHERE e2.seriesId = e.seriesId AND e2.deletedDate IS NULL) " +
            "ORDER BY e.eventDate ASC")
    Page<ConcertSummaryResponse> findConcertSummaries(Pageable pageable);
}
