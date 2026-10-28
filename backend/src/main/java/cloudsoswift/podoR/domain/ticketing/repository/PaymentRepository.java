package cloudsoswift.podoR.domain.ticketing.repository;

import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByTicketingOrder_Seq(Long orderSeq);
}
