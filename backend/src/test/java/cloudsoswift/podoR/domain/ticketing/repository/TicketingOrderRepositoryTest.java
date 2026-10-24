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
}
