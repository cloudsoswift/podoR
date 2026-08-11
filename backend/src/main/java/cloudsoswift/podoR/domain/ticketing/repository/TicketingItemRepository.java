package cloudsoswift.podoR.domain.ticketing.repository;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketingItemRepository extends JpaRepository<TicketingItem, Long> {

    // 사용자가 특정 시리즈에서 이미 결제(PAID)한 좌석 수 — 1인 최대 좌석수 한도 집계
    @Query("SELECT COUNT(ti) FROM TicketingItem ti " +
           "JOIN ti.ticketingOrder o JOIN o.event e " +
           "WHERE o.user.seq = :userSeq AND o.status = 'PAID' AND e.seriesId = :seriesId")
    long countPaidSeatsInSeries(@Param("userSeq") Long userSeq, @Param("seriesId") String seriesId);
}
