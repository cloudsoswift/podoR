package cloudsoswift.podoR.domain.ticketing.repository;

import java.util.Collection;
import org.springframework.data.jpa.repository.Modifying;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TicketingOrderRepository extends JpaRepository<TicketingOrder, Long> {

    // 예매연월 기준 조회
    @Query("SELECT o FROM TicketingOrder o " +
            "JOIN FETCH o.event e JOIN FETCH e.venue " +
            "WHERE o.user.seq = :userSeq AND o.orderedAt >= :start AND o.orderedAt < :end " +
            "AND o.status IN ('PAID', 'PARTIALLY_CANCELLED', 'CANCELLED') " +
            "ORDER BY o.orderedAt DESC")
    List<TicketingOrder> findByUserAndOrderedAtInRange(@Param("userSeq") Long userSeq,
                                                       @Param("start") LocalDateTime start,
                                                       @Param("end") LocalDateTime end);

    // 관람연월 기준 조회
    @Query("SELECT o FROM TicketingOrder o " +
            "JOIN FETCH o.event e JOIN FETCH e.venue " +
            "WHERE o.user.seq = :userSeq AND e.eventDate >= :start AND e.eventDate < :end " +
            "AND o.status IN ('PAID', 'PARTIALLY_CANCELLED', 'CANCELLED') " +
            "ORDER BY e.eventDate DESC")
    List<TicketingOrder> findByUserAndEventDateInRange(@Param("userSeq") Long userSeq,
                                                       @Param("start") LocalDateTime start,
                                                       @Param("end") LocalDateTime end);

    // 결제 대기(PENDING) 주문, 최신순 — 같은 사용자·회차의 준비 재요청 처리용.
    // 동시 준비(여러 탭)로 둘 이상 생길 수 있어 List 로 받아 호출부가 정리한다.
    @Query("SELECT DISTINCT o FROM TicketingOrder o " +
            "LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.eventSeat " +
            "WHERE o.user.seq = :userSeq AND o.event.seq = :eventSeq AND o.status = 'PENDING' " +
            "ORDER BY o.orderedAt DESC, o.seq DESC")
    List<TicketingOrder> findPendingByUserAndEvent(@Param("userSeq") Long userSeq,
                                                   @Param("eventSeq") Long eventSeq);

    // 상세 내역 조회
    @Query("SELECT DISTINCT o FROM TicketingOrder o " +
            "JOIN FETCH o.event e JOIN FETCH e.venue " +
            "LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.eventSeat es LEFT JOIN FETCH es.seat " +
            "WHERE o.orderNumber = :orderNumber")
    Optional<TicketingOrder> findDetailByOrderNumber(@Param("orderNumber") String orderNumber);

    // 방치 만료 대상 - 컷오프보다 오래된 PENDING 주문 seq
    @Query("SELECT o.seq FROM TicketingOrder o WHERE o.status = :status AND o.orderedAt < :cutoff")
    List<Long> findStaleSeqs(@Param("status") String status, @Param("cutoff") LocalDateTime cutoff);

    // 벌크 UPDATE 는 @Version 을 우회하므로 직접 올려, 같은 주문을 쥔 확정 트랜잭션의 낙관적 락이 실패하게 한다.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE TicketingOrder o SET o.status = :to, o.version = o.version + 1 " +
            "WHERE o.seq IN :seqs AND o.status = :from")
    int markExpired(@Param("seqs") Collection<Long> seqs, @Param("from") String from, @Param("to") String to);
}
