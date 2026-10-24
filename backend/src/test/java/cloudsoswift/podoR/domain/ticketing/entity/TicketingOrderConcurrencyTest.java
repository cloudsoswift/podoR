package cloudsoswift.podoR.domain.ticketing.entity;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.RollbackException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 같은 주문을 두 트랜잭션이 동시에 부분 취소하면(관객 취소 vs 좌석맵 저장, 또는 두 탭)
 * 나중에 커밋하는 쪽이 낙관적 락으로 실패해야 한다. 아니면 총액·결제 취소액이 덮어써진다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TicketingOrderConcurrencyTest {

    @Autowired EntityManagerFactory emf;

    Long orderSeq;
    Long itemA;
    Long itemB;
    List<Object> created;

    private void setUp() {
        EntityManager em = emf.createEntityManager();
        em.getTransaction().begin();
        User user = EntityFixtures.user("lock-u");
        Venue venue = EntityFixtures.venue("lock-v");
        em.persist(user);
        em.persist(venue);
        Event event = EntityFixtures.event(user, venue, "LOCK-E", "LOCK-S");
        em.persist(event);
        Seat s1 = EntityFixtures.seat(venue, "A", "1", 1);
        Seat s2 = EntityFixtures.seat(venue, "A", "1", 2);
        em.persist(s1);
        em.persist(s2);
        EventSeat es1 = EntityFixtures.eventSeat(event, s1, SeatStatus.SOLD, 0L);
        EventSeat es2 = EntityFixtures.eventSeat(event, s2, SeatStatus.SOLD, 0L);
        em.persist(es1);
        em.persist(es2);
        TicketingOrder order = EntityFixtures.order(event, user, "LOCK-O", "PAID");
        em.persist(order);
        TicketingItem a = EntityFixtures.item(order, es1);
        TicketingItem b = EntityFixtures.item(order, es2);
        em.persist(a);
        em.persist(b);
        em.getTransaction().commit();
        orderSeq = order.getSeq();
        itemA = a.getSeq();
        itemB = b.getSeq();
        em.close();
    }

    @AfterEach
    void cleanUp() {
        EntityManager em = emf.createEntityManager();
        em.getTransaction().begin();
        for (String q : List.of(
                "DELETE FROM TicketingItem", "DELETE FROM TicketingOrder", "DELETE FROM EventSeat",
                "DELETE FROM Seat", "DELETE FROM Event", "DELETE FROM Venue v WHERE v.name = 'lock-v'",
                "DELETE FROM User u WHERE u.providerId = 'lock-u'")) {
            em.createQuery(q).executeUpdate();
        }
        em.getTransaction().commit();
        em.close();
    }

    @Test
    void 같은_주문을_동시에_부분취소하면_나중_커밋이_실패한다() {
        setUp();
        EntityManager em1 = emf.createEntityManager();
        EntityManager em2 = emf.createEntityManager();
        em1.getTransaction().begin();
        em2.getTransaction().begin();
        TicketingOrder o1 = em1.find(TicketingOrder.class, orderSeq);
        TicketingOrder o2 = em2.find(TicketingOrder.class, orderSeq);
        LocalDateTime now = LocalDateTime.now();

        o1.cancelItems(List.of(em1.find(TicketingItem.class, itemA)), now);
        em1.getTransaction().commit();

        o2.cancelItems(List.of(em2.find(TicketingItem.class, itemB)), now);
        assertThatThrownBy(() -> em2.getTransaction().commit())
                .isInstanceOf(RollbackException.class)
                .hasCauseInstanceOf(OptimisticLockException.class);
        em1.close();
        em2.close();

        EntityManager check = emf.createEntityManager();
        TicketingOrder after = check.find(TicketingOrder.class, orderSeq);
        assertThat(after.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(after.activeItems()).extracting(TicketingItem::getSeq).containsExactly(itemB);
        check.close();
    }
}
