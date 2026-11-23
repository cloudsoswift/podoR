package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.stream.dto.StreamViewResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
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
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(StreamViewService.class)
class StreamViewServiceTest {

    @Autowired TestEntityManager em;
    @Autowired StreamViewService service;

    User viewer;
    Venue venue;
    Event event;
    int seatNo = 0;
    final LocalDateTime now = LocalDateTime.of(2026, 11, 2, 20, 0);

    @BeforeEach
    void setUp() {
        viewer = em.persist(EntityFixtures.user("viewer"));
        venue = em.persist(EntityFixtures.venue("v"));
        event = em.persist(EntityFixtures.event(viewer, venue, "E1", "S1"));
    }

    private TicketingItem item(TicketingOrder order) {
        Seat seat = em.persist(EntityFixtures.seat(venue, "A", "1", ++seatNo));
        EventSeat es = em.persist(EntityFixtures.eventSeat(event, seat, SeatStatus.SOLD, 0L));
        return em.persist(EntityFixtures.item(order, es));
    }

    private TicketingOrder order(String no) {
        return em.persist(EntityFixtures.order(event, viewer, no, "PAID"));
    }

    private void status(StreamStatus s, VodStatus v) {
        ReflectionTestUtils.setField(event, "streamStatus", s);
        ReflectionTestUtils.setField(event, "vodStatus", v);
        em.flush();
    }

    private static void assertForbidden(Runnable r) {
        assertThatThrownBy(r::run).isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void 예매자가_아니면_403() {
        User stranger = em.persist(EntityFixtures.user("stranger"));
        item(order("O1"));
        em.flush();

        assertForbidden(() -> service.view(stranger.getSeq(), "E1"));
    }

    @Test
    void 일부_취소하고_남은_좌석이_있으면_200() {
        TicketingOrder o = order("O1");
        item(o);
        TicketingItem gone = item(o);
        o.cancelItems(List.of(gone), now);
        em.flush();

        StreamViewResponse res = service.view(viewer.getSeq(), "E1");

        assertThat(res.status()).isEqualTo("SCHEDULED");
        assertThat(res.vodStatus()).isEqualTo("NONE");
        assertThat(res.liveUrl()).isNull();
        assertThat(res.vodUrl()).isNull();
    }

    @Test
    void 전부_취소하면_403() {
        TicketingOrder o = order("O1");
        TicketingItem only = item(o);
        o.cancelItems(List.of(only), now);
        em.flush();

        assertForbidden(() -> service.view(viewer.getSeq(), "E1"));
    }

    @Test
    void LIVE_면_현재_세션의_liveUrl() {
        item(order("O1"));
        em.persist(StreamSession.start(event, 1, now.minusMinutes(30)));
        em.persist(StreamSession.start(event, 2, now));
        status(StreamStatus.LIVE, VodStatus.NONE);

        StreamViewResponse res = service.view(viewer.getSeq(), "E1");

        assertThat(res.status()).isEqualTo("LIVE");
        assertThat(res.liveUrl()).isEqualTo("/media/hls/E1/2/master.m3u8");
        assertThat(res.vodUrl()).isNull();
    }

    @Test
    void READY_면_vodUrl() {
        item(order("O1"));
        status(StreamStatus.ENDED, VodStatus.READY);

        StreamViewResponse res = service.view(viewer.getSeq(), "E1");

        assertThat(res.vodUrl()).isEqualTo("/media/vod/E1.mp4");
        assertThat(res.liveUrl()).isNull();
    }
}
