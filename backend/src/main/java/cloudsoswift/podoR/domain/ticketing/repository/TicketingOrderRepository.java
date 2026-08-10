package cloudsoswift.podoR.domain.ticketing.repository;

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
            "ORDER BY o.orderedAt DESC")
    List<TicketingOrder> findByUserAndOrderedAtInRange(@Param("userSeq") Long userSeq,
                                                       @Param("start") LocalDateTime start,
                                                       @Param("end") LocalDateTime end);

    // 관람연월 기준 조회
    @Query("SELECT o FROM TicketingOrder o " +
            "JOIN FETCH o.event e JOIN FETCH e.venue " +
            "WHERE o.user.seq = :userSeq AND e.eventDate >= :start AND e.eventDate < :end " +
            "ORDER BY e.eventDate DESC")
    List<TicketingOrder> findByUserAndEventDateInRange(@Param("userSeq") Long userSeq,
                                                       @Param("start") LocalDateTime start,
                                                       @Param("end") LocalDateTime end);

    // 상세 내역 조회
    @Query("SELECT DISTINCT o FROM TicketingOrder o " +
            "JOIN FETCH o.event e JOIN FETCH e.venue " +
            "LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.eventSeat es LEFT JOIN FETCH es.seat " +
            "WHERE o.orderNumber = :orderNumber")
    Optional<TicketingOrder> findDetailByOrderNumber(@Param("orderNumber") String orderNumber);
}
