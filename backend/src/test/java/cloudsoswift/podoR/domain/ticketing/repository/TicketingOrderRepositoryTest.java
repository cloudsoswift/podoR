package cloudsoswift.podoR.domain.ticketing.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TicketingOrderRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired TicketingOrderRepository orderRepository;
    @Autowired PaymentRepository paymentRepository;

    /** confirmOrder 와 같은 순서: 새 주문을 save 한 뒤 그 객체로 결제를 저장한다. */
    @Test
    void 새_주문을_save_하면_같은_객체가_영속화되어_결제가_참조할_수_있다() {
        User user = em.persist(EntityFixtures.user("u1"));
        Venue venue = em.persist(EntityFixtures.venue("v"));
        Event event = em.persist(EntityFixtures.event(user, venue, "E1", "S1"));
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", "1", 1));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.AVAILABLE, 0L));

        TicketingOrder order = TicketingOrder.builder().event(event).user(user)
                .orderNumber("O1").totalPrice(10000).status("PAID").build();
        order.addItem(TicketingItem.of(es));
        orderRepository.save(order);
        paymentRepository.save(Payment.builder().ticketingOrder(order).method("MOCK").amount(10000L).build());
        em.flush();

        assertThat(order.getSeq()).isNotNull();
    }

    @Test
    void 마이페이지_목록은_PENDING_FAILED_EXPIRED_를_제외한다() {
        User user = em.persist(EntityFixtures.user("u2"));
        Venue venue = em.persist(EntityFixtures.venue("v2"));
        Event event = em.persist(EntityFixtures.event(user, venue, "E2", "S2"));
        for (String st : new String[]{"PAID", "PARTIALLY_CANCELLED", "CANCELLED", "PENDING", "FAILED", "EXPIRED"}) {
            em.persist(EntityFixtures.order(event, user, "N-" + st, st));
        }
        em.flush();
        LocalDateTime start = LocalDateTime.now().minusDays(1);
        LocalDateTime end = LocalDateTime.now().plusDays(1);

        assertThat(orderRepository.findByUserAndOrderedAtInRange(user.getSeq(), start, end))
                .extracting(TicketingOrder::getStatus)
                .containsExactlyInAnyOrder("PAID", "PARTIALLY_CANCELLED", "CANCELLED");
        assertThat(orderRepository.findByUserAndEventDateInRange(user.getSeq(), start, end))
                .extracting(TicketingOrder::getStatus)
                .containsExactlyInAnyOrder("PAID", "PARTIALLY_CANCELLED", "CANCELLED");
    }

    @Test
    void 사용자_회차의_PENDING_주문만_항목과_함께_조회한다() {
        User user = em.persist(EntityFixtures.user("u3"));
        Venue venue = em.persist(EntityFixtures.venue("v3"));
        Event event = em.persist(EntityFixtures.event(user, venue, "E3", "S3"));
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", "1", 1));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.AVAILABLE, 0L));
        em.persist(EntityFixtures.order(event, user, "F-1", "FAILED"));
        TicketingOrder pending = TicketingOrder.pending(event, user, "P-1", java.util.List.of(es));
        em.persist(pending);
        em.flush();
        em.clear();

        TicketingOrder found = orderRepository.findPendingByUserAndEvent(user.getSeq(), event.getSeq()).get(0);

        assertThat(found.getOrderNumber()).isEqualTo("P-1");
        assertThat(found.getItems()).hasSize(1);
        assertThat(orderRepository.findPendingByUserAndEvent(user.getSeq() + 999, event.getSeq())).isEmpty();
    }

    @Test
    void PENDING_이_둘이면_둘다_최신순으로_돌려준다() {
        User user = em.persist(EntityFixtures.user("u4"));
        Venue venue = em.persist(EntityFixtures.venue("v4"));
        Event event = em.persist(EntityFixtures.event(user, venue, "E4", "S4"));
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", "1", 1));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.AVAILABLE, 0L));
        em.persist(TicketingOrder.pending(event, user, "P-A", java.util.List.of(es)));
        em.persist(TicketingOrder.pending(event, user, "P-B", java.util.List.of(es)));
        em.flush();
        em.clear();

        assertThat(orderRepository.findPendingByUserAndEvent(user.getSeq(), event.getSeq()))
                .extracting(TicketingOrder::getOrderNumber).containsExactly("P-B", "P-A");
    }
}
