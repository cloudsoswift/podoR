package cloudsoswift.podoR.domain.event.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EventSeatRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired EventSeatRepository repo;

    User user;
    Venue venue;
    int seatNo = 0;

    @BeforeEach
    void base() {
        user = em.persist(EntityFixtures.user("u1"));
        venue = em.persist(EntityFixtures.venue("v"));
    }

    private Event event(String eventId) {
        return em.persist(EntityFixtures.event(user, venue, eventId, "S1"));
    }

    private EventSeat eventSeat(Event e, String section, SeatStatus status, long version) {
        Seat seat = em.persist(EntityFixtures.seat(venue, section, "1", ++seatNo));
        return em.persist(EntityFixtures.eventSeat(e, seat, status, version));
    }

    @Test
    void updateStatusIfCurrent_expected상태_좌석만_전이하고_version갱신() {
        Event e = event("E1");
        EventSeat a1 = eventSeat(e, "A", SeatStatus.AVAILABLE, 0L);
        EventSeat a2 = eventSeat(e, "A", SeatStatus.AVAILABLE, 0L);
        EventSeat sold = eventSeat(e, "A", SeatStatus.SOLD, 0L);
        em.flush();

        int affected = repo.updateStatusIfCurrent(
                List.of(a1.getSeq(), a2.getSeq(), sold.getSeq()),
                e.getSeq(), SeatStatus.AVAILABLE, SeatStatus.SOLD, 5L);

        assertThat(affected).isEqualTo(2); // sold 는 expected=AVAILABLE 불일치 → 제외
        em.clear();
        assertThat(repo.findById(a1.getSeq()).orElseThrow().getStatus()).isEqualTo(SeatStatus.SOLD);
        assertThat(repo.findById(a1.getSeq()).orElseThrow().getChangeVersion()).isEqualTo(5L);
        assertThat(repo.findById(sold.getSeq()).orElseThrow().getChangeVersion()).isEqualTo(0L); // 불변
    }

    @Test
    void updateStatusIfCurrent_다른이벤트_좌석은_seq가_리스트에_있어도_불변() {
        Event e1 = event("E1");
        Event e2 = event("E2");
        EventSeat a = eventSeat(e1, "A", SeatStatus.AVAILABLE, 0L);
        EventSeat b = eventSeat(e2, "A", SeatStatus.AVAILABLE, 0L); // 다른 이벤트
        em.flush();

        int affected = repo.updateStatusIfCurrent(
                List.of(a.getSeq(), b.getSeq()), e1.getSeq(),
                SeatStatus.AVAILABLE, SeatStatus.SOLD, 9L);

        assertThat(affected).isEqualTo(1); // e1 의 a 만
        em.clear();
        assertThat(repo.findById(b.getSeq()).orElseThrow().getStatus()).isEqualTo(SeatStatus.AVAILABLE);
    }

    @Test
    void findAllByEventSeqWithSeat_해당이벤트좌석만_seat포함() {
        Event e1 = event("E1");
        Event e2 = event("E2");
        eventSeat(e1, "A", SeatStatus.AVAILABLE, 0L);
        eventSeat(e1, "A", SeatStatus.AVAILABLE, 0L);
        eventSeat(e2, "A", SeatStatus.AVAILABLE, 0L); // 다른 이벤트
        em.flush();
        em.clear();

        List<EventSeat> r = repo.findAllByEventSeqWithSeat(e1.getSeq());

        assertThat(r).hasSize(2);
        assertThat(r).allSatisfy(es -> assertThat(es.getSeat()).isNotNull());
    }

    @Test
    void findChangesSince_since초과분만_changeVersion_오름차순() {
        Event e = event("E1");
        eventSeat(e, "A", SeatStatus.AVAILABLE, 1L);
        eventSeat(e, "A", SeatStatus.AVAILABLE, 2L);
        eventSeat(e, "A", SeatStatus.AVAILABLE, 3L);
        em.flush();
        em.clear();

        List<EventSeat> r = repo.findChangesSince(e.getSeq(), 1L);

        assertThat(r).extracting(EventSeat::getChangeVersion).containsExactly(2L, 3L);
    }

    @Test
    void findChangesSinceInSection_섹션필터() {
        Event e = event("E1");
        eventSeat(e, "A", SeatStatus.AVAILABLE, 1L);
        eventSeat(e, "B", SeatStatus.AVAILABLE, 2L);
        em.flush();
        em.clear();

        List<EventSeat> r = repo.findChangesSinceInSection(e.getSeq(), 0L, "A");

        assertThat(r).isNotEmpty();
        assertThat(r).allSatisfy(es -> assertThat(es.getSeat().getSection()).isEqualTo("A"));
    }
}
