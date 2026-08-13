package cloudsoswift.podoR.domain.ticketing.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TicketingItemRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired TicketingItemRepository repo;

    User user;
    Venue venue;
    int seatNo = 0; // 좌석 유니크(uk_seat_location) 회피용 카운터

    @BeforeEach
    void base() {
        user = em.persist(EntityFixtures.user("u1"));
        venue = em.persist(EntityFixtures.venue("v"));
    }

    /** event/order 에 좌석 1개짜리 아이템을 저장. */
    private void addItem(Event event, User owner, String orderNo, String orderStatus) {
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", "1", ++seatNo));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.SOLD, 0L));
        TicketingOrder order = em.persist(EntityFixtures.order(event, owner, orderNo, orderStatus));
        em.persist(EntityFixtures.item(order, es));
    }

    @Test
    void PAID_아이템만_집계하고_CANCELLED는_제외() {
        Event e = em.persist(EntityFixtures.event(user, venue, "E1", "S1"));
        addItem(e, user, "O1", "PAID");
        addItem(e, user, "O2", "PAID");
        addItem(e, user, "O3", "CANCELLED"); // 제외 대상
        em.flush();

        assertThat(repo.countPaidSeatsInSeries(user.getSeq(), "S1")).isEqualTo(2L);
    }

    @Test
    void 다른시리즈_다른유저_아이템은_집계에서_제외() {
        User other = em.persist(EntityFixtures.user("u2"));
        Event s1 = em.persist(EntityFixtures.event(user, venue, "E1", "S1"));
        Event s2 = em.persist(EntityFixtures.event(user, venue, "E2", "S2"));
        addItem(s1, user, "O1", "PAID");   // (u1,S1) 집계 대상
        addItem(s2, user, "O2", "PAID");   // 다른 시리즈 → 제외
        addItem(s1, other, "O3", "PAID");  // 다른 유저 → 제외
        em.flush();

        assertThat(repo.countPaidSeatsInSeries(user.getSeq(), "S1")).isEqualTo(1L);
    }
}
