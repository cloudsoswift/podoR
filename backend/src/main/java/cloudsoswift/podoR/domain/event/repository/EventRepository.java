package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.dto.EventSeriesResponse;
import cloudsoswift.podoR.domain.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // 특정 공연장의 활성 이벤트(이른 순) — 소비자 공연장 상세용
    java.util.List<Event> findAllByVenue_SeqAndDeletedDateIsNullOrderByEventDateAsc(Long venueSeq);

    // Admin: 미삭제 이벤트 제목 검색(부분일치). keyword 는 non-null 전제.
    @Query("SELECT e FROM Event e WHERE e.deletedDate IS NULL AND " +
            "LOWER(e.title) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<Event> searchActiveEvents(@Param("keyword") String keyword, Pageable pageable);

    // ===== 스트리밍 =====

    Optional<Event> findByStreamKeyAndDeletedDateIsNull(String streamKey);

    java.util.List<Event> findAllByHost_SeqAndDeletedDateIsNullOrderByEventDateDesc(Long hostSeq);

    java.util.List<Event> findAllByVodStatus(VodStatus vodStatus);

    long countByStreamStatusInAndSeqNot(java.util.Collection<StreamStatus> statuses, Long seq);

    // 조건부 상태 전이(compare-and-set). 콜백·스케줄러·종료 버튼이 겹쳐도 하나만 이긴다.
    // 스트리밍 도입 전 회차는 stream_status 가 NULL 이라 IN 으로는 못 잡으므로 allowNull 로 따로 받는다.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Event e SET e.streamStatus = :to WHERE e.seq = :seq AND " +
            "(e.streamStatus IN :from OR (:allowNull = true AND e.streamStatus IS NULL))")
    int transitStreamStatus(@Param("seq") Long seq,
                            @Param("from") java.util.Collection<StreamStatus> from,
                            @Param("allowNull") boolean allowNull,
                            @Param("to") StreamStatus to);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Event e SET e.vodStatus = :to WHERE e.seq = :seq AND e.vodStatus IN :from")
    int transitVodStatus(@Param("seq") Long seq,
                         @Param("from") java.util.Collection<VodStatus> from,
                         @Param("to") VodStatus to);

    // 끊긴 채 유예 시간을 넘긴 회차. 끊긴 시각은 마지막 세션의 ended_at 이다.
    @Query("SELECT e.seq FROM Event e WHERE e.streamStatus = cloudsoswift.podoR.domain.stream.entity.StreamStatus.INTERRUPTED " +
            "AND (SELECT MAX(s.endedAt) FROM StreamSession s WHERE s.event = e) < :cutoff")
    java.util.List<Long> findInterruptedSince(@Param("cutoff") java.time.LocalDateTime cutoff);

    // 공연 시리즈 목록: series_id 그룹의 대표(가장 이른 회차) 1건 + 회차 수
    @Query("SELECT new cloudsoswift.podoR.domain.event.dto.EventSeriesResponse(" +
            " e.seriesId, e.eventId, e.title, e.eventType, e.venue.name, e.eventDate, " +
            " (SELECT COUNT(e3) FROM Event e3 WHERE e3.seriesId = e.seriesId AND e3.deletedDate IS NULL)) " +
            "FROM Event e " +
            "WHERE e.deletedDate IS NULL " +
            "AND e.eventDate = (SELECT MIN(e2.eventDate) FROM Event e2 " +
            "                   WHERE e2.seriesId = e.seriesId AND e2.deletedDate IS NULL) " +
            "ORDER BY e.eventDate ASC")
    Page<EventSeriesResponse> findEventSeries(Pageable pageable);
}
