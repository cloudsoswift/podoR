package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // 조건부 상태 전이(이중판매/이중취소 차단): expected 상태인 좌석만 status 로, change_version 갱신. 반영 행수 반환.
    // clearAutomatically 는 쓰지 않는다 — 같은 트랜잭션의 order/payment 엔티티 변경이 컨텍스트 초기화로 유실되는 것을 막기 위함.
    @Modifying
    @Query("UPDATE EventSeat es SET es.status = :status, es.changeVersion = :version " +
            "WHERE es.seq IN :seqs AND es.event.seq = :eventSeq AND es.status = :expected")
    int updateStatusIfCurrent(@Param("seqs") List<Long> seqs,
                              @Param("eventSeq") Long eventSeq,
                              @Param("expected") SeatStatus expected,
                              @Param("status") SeatStatus status,
                              @Param("version") Long version);
}
