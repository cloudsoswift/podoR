package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.EventSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EventSeatRepository extends JpaRepository<EventSeat, Long> {

    // 스냅샷/플랜 역산용: 이벤트의 전체 EventSeat (seat fetch join 으로 N+1 회피)
    @Query("SELECT es FROM EventSeat es JOIN FETCH es.seat WHERE es.event.seq = :eventSeq")
    List<EventSeat> findAllByEventSeqWithSeat(@Param("eventSeq") Long eventSeq);

    // 증분: change_version 초과분만 (seat fetch join)
    @Query("SELECT es FROM EventSeat es JOIN FETCH es.seat " +
            "WHERE es.event.seq = :eventSeq AND es.changeVersion > :since " +
            "ORDER BY es.changeVersion ASC")
    List<EventSeat> findChangesSince(@Param("eventSeq") Long eventSeq,
                                     @Param("since") Long since);

    // 증분(섹션 필터): SeatMap Viewer 용
    @Query("SELECT es FROM EventSeat es JOIN FETCH es.seat " +
            "WHERE es.event.seq = :eventSeq AND es.changeVersion > :since AND es.seat.section = :section " +
            "ORDER BY es.changeVersion ASC")
    List<EventSeat> findChangesSinceInSection(@Param("eventSeq") Long eventSeq,
                                              @Param("since") Long since,
                                              @Param("section") String section);
}
