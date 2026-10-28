package cloudsoswift.podoR.domain.ticketing.repository;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TicketingItemRepository extends JpaRepository<TicketingItem, Long> {

    // 사용자가 특정 시리즈에서 이미 결제(PAID)한 좌석 수 — 1인 최대 좌석수 한도 집계.
    // 부분 취소가 있으므로 주문이 아니라 항목 상태로 센다. 회차는 주문 → 회차로 조인한다
    // (공연장 배치 변경으로 회차 좌석 연결이 끊긴 항목도 세기 위해).
    @Query("SELECT COUNT(ti) FROM TicketingItem ti " +
           "JOIN ti.ticketingOrder o JOIN o.event e " +
           "WHERE o.user.seq = :userSeq AND ti.status = 'PAID' AND e.seriesId = :seriesId")
    long countPaidSeatsInSeries(@Param("userSeq") Long userSeq, @Param("seriesId") String seriesId);

    // 좌석맵 저장 시 정리할 회차 좌석을 참조하는 항목(취소된 것 포함). 주문·회차·결제를 함께 읽는다.
    @Query("SELECT ti FROM TicketingItem ti " +
           "JOIN FETCH ti.ticketingOrder o JOIN FETCH o.event LEFT JOIN FETCH o.payment " +
           "WHERE ti.eventSeat.seq IN :eventSeatSeqs")
    List<TicketingItem> findAllByEventSeatSeqIn(@Param("eventSeatSeqs") Collection<Long> eventSeatSeqs);
}
