package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentProperties;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PendingOrderExpiry.class)
@EnableConfigurationProperties(PaymentProperties.class)
class PendingOrderExpiryTest {

    @Autowired TestEntityManager em;
    @Autowired PendingOrderExpiry expiry;
    @Autowired TicketingOrderRepository orderRepository;
    @Autowired TicketingItemRepository itemRepository;
    @Autowired PaymentRepository paymentRepository;

    private User user;
    private Event event;
    private Venue venue;
    private int n;

    private TicketingOrder order(String number, String orderStatus) {
        if (user == null) {
            user = em.persist(EntityFixtures.user("ue"));
            venue = em.persist(EntityFixtures.venue("ve"));
            event = em.persist(EntityFixtures.event(user, venue, "EE", "SE"));
        }
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", String.valueOf(++n), n));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.AVAILABLE, 0L));
        TicketingOrder o = TicketingOrder.pending(event, user, number, List.of(es));
        if (!TicketingOrder.STATUS_PENDING.equals(orderStatus)) {
            o = TicketingOrder.builder().event(event).user(user).orderNumber(number)
                    .totalPrice(10000).status(orderStatus).build();
            o.addItem(TicketingItem.of(es));
        }
        em.persist(o);
        em.persist(Payment.ready(o, 10000L));
        return o;
    }

    private void backdate(TicketingOrder o, int minutesAgo) {
        em.flush();
        em.getEntityManager().createNativeQuery("UPDATE ticketing_order SET ordered_at = ?1 WHERE seq = ?2")
                .setParameter(1, LocalDateTime.now().minusMinutes(minutesAgo))
                .setParameter(2, o.getSeq()).executeUpdate();
        em.clear();
    }

    private String paymentStatus(TicketingOrder o) {
        return (String) em.getEntityManager()
                .createQuery("SELECT p.status FROM Payment p WHERE p.ticketingOrder.seq = :s")
                .setParameter("s", o.getSeq()).getSingleResult();
    }

    @Test
    void 컷오프보다_오래된_PENDING_만_EXPIRED() {
        TicketingOrder old = order("X-OLD", "PENDING");
        TicketingOrder fresh = order("X-NEW", "PENDING");
        backdate(old, 16);
        backdate(fresh, 14);

        int count = expiry.expireStale(LocalDateTime.now());
        em.clear();

        assertThat(count).isEqualTo(1);
        TicketingOrder o = em.find(TicketingOrder.class, old.getSeq());
        assertThat(o.getStatus()).isEqualTo("EXPIRED");
        assertThat(o.getItems()).extracting(TicketingItem::getStatus).containsOnly("EXPIRED");
        assertThat(paymentStatus(old)).isEqualTo("EXPIRED");
        assertThat(em.find(TicketingOrder.class, fresh.getSeq()).getStatus()).isEqualTo("PENDING");
        assertThat(paymentStatus(fresh)).isEqualTo("READY");
    }

    @Test
    void PAID_FAILED_는_건드리지_않는다() {
        TicketingOrder paid = order("X-PAID", "PAID");
        TicketingOrder failed = order("X-FAIL", "FAILED");
        backdate(paid, 60);
        backdate(failed, 60);

        assertThat(expiry.expireStale(LocalDateTime.now())).isZero();
        em.clear();

        assertThat(em.find(TicketingOrder.class, paid.getSeq()).getStatus()).isEqualTo("PAID");
        assertThat(em.find(TicketingOrder.class, failed.getSeq()).getStatus()).isEqualTo("FAILED");
        assertThat(paymentStatus(paid)).isEqualTo("READY");
    }

    @Test
    void 대상_목록_뒤에_PAID_가_된_주문은_항목_결제_모두_그대로다() {
        TicketingOrder stale = order("X-STALE", "PENDING");
        TicketingOrder raced = order("X-RACED", "PENDING");
        backdate(stale, 20);
        backdate(raced, 20);
        // 확정 트랜잭션이 select 와 update 사이에 커밋한 상황을 흉내 낸다.
        em.getEntityManager().createQuery("UPDATE TicketingOrder o SET o.status = 'PAID' WHERE o.seq = :s")
                .setParameter("s", raced.getSeq()).executeUpdate();
        em.getEntityManager().createQuery("UPDATE TicketingItem i SET i.status = 'PAID' WHERE i.ticketingOrder.seq = :s")
                .setParameter("s", raced.getSeq()).executeUpdate();
        em.getEntityManager().createQuery("UPDATE Payment p SET p.status = 'COMPLETED' WHERE p.ticketingOrder.seq = :s")
                .setParameter("s", raced.getSeq()).executeUpdate();
        em.clear();
        List<Long> seqs = List.of(stale.getSeq(), raced.getSeq());

        int expired = orderRepository.markExpired(seqs, "PENDING", "EXPIRED");
        itemRepository.markStatusByOrderSeqs(seqs, "EXPIRED", "PENDING", "EXPIRED");
        paymentRepository.markExpiredByOrderSeqs(seqs, "EXPIRED", "READY", "EXPIRED");
        em.clear();

        assertThat(expired).isEqualTo(1);
        TicketingOrder r = em.find(TicketingOrder.class, raced.getSeq());
        assertThat(r.getStatus()).isEqualTo("PAID");
        assertThat(r.getItems()).extracting(TicketingItem::getStatus).containsOnly("PAID");
        assertThat(paymentStatus(raced)).isEqualTo("COMPLETED");
        assertThat(em.find(TicketingOrder.class, stale.getSeq()).getStatus()).isEqualTo("EXPIRED");
        assertThat(paymentStatus(stale)).isEqualTo("EXPIRED");
    }

    @Test
    void 두번_돌려도_결과_같다() {
        TicketingOrder old = order("X-TWICE", "PENDING");
        backdate(old, 20);

        assertThat(expiry.expireStale(LocalDateTime.now())).isEqualTo(1);
        assertThat(expiry.expireStale(LocalDateTime.now())).isZero();
        em.clear();

        assertThat(em.find(TicketingOrder.class, old.getSeq()).getStatus()).isEqualTo("EXPIRED");
    }
}
