package cloudsoswift.podoR.domain.ticketing.repository;

import java.util.Collection;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByTicketingOrder_Seq(Long orderSeq);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Payment p SET p.status = :to WHERE p.status = :from AND p.ticketingOrder.seq IN " +
           "(SELECT o.seq FROM TicketingOrder o WHERE o.seq IN :orderSeqs AND o.status = :orderStatus)")
    int markExpiredByOrderSeqs(@Param("orderSeqs") Collection<Long> orderSeqs, @Param("orderStatus") String orderStatus,
                               @Param("from") String from, @Param("to") String to);
}
