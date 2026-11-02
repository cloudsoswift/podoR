package cloudsoswift.podoR.domain.stream.repository;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class StreamSessionRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired StreamSessionRepository sessionRepository;
    @Autowired EventRepository eventRepository;

    User host;
    Venue venue;
    final LocalDateTime now = LocalDateTime.of(2026, 11, 2, 20, 0);

    @BeforeEach
    void setUp() {
        host = em.persist(EntityFixtures.user("h"));
        venue = em.persist(EntityFixtures.venue("v"));
    }

    private Event event(String id, StreamStatus status) {
        return em.persist(Event.builder().host(host).venue(venue).eventId(id).seriesId("S")
                .title("t").eventType("CONCERT").eventDate(now).ticketingDate(now)
                .streamStatus(status).build());
    }

    @Test
    void 현재_세션은_session_no_가_가장_큰_행() {
        Event e = event("E1", StreamStatus.LIVE);
        em.persist(StreamSession.start(e, 1, now.minusMinutes(30)));
        em.persist(StreamSession.start(e, 2, now));
        em.flush();

        assertThat(sessionRepository.findTopByEvent_SeqOrderBySessionNoDesc(e.getSeq()))
                .get().extracting(StreamSession::getSessionNo).isEqualTo(2);
        assertThat(sessionRepository.findAllByEvent_SeqOrderBySessionNoAsc(e.getSeq()))
                .extracting(StreamSession::getSessionNo).containsExactly(1, 2);
    }

    @Test
    void INTERRUPTED_이고_마지막_끊김이_cutoff_이전인_회차만_조회() {
        Event old = event("OLD", StreamStatus.INTERRUPTED);
        StreamSession s1 = StreamSession.start(old, 1, now.minusMinutes(20));
        s1.end(now.minusMinutes(4));
        em.persist(s1);
        Event recent = event("RECENT", StreamStatus.INTERRUPTED);
        StreamSession s2 = StreamSession.start(recent, 1, now.minusMinutes(20));
        s2.end(now.minusMinutes(1));
        em.persist(s2);
        Event live = event("LIVE", StreamStatus.LIVE);
        StreamSession s3 = StreamSession.start(live, 1, now.minusMinutes(20));
        s3.end(now.minusMinutes(10));
        em.persist(s3);
        em.flush();

        List<Long> found = eventRepository.findInterruptedSince(now.minusMinutes(3));

        assertThat(found).containsExactly(old.getSeq());
    }

    @Test
    void 조건부_전이는_현재_상태가_맞을_때만_1을_반환() {
        Event e = event("E1", StreamStatus.SCHEDULED);
        em.flush();

        assertThat(eventRepository.transitStreamStatus(e.getSeq(),
                List.of(StreamStatus.SCHEDULED), false, StreamStatus.LIVE)).isEqualTo(1);
        assertThat(eventRepository.transitStreamStatus(e.getSeq(),
                List.of(StreamStatus.SCHEDULED), false, StreamStatus.LIVE)).isEqualTo(0);
        assertThat(em.find(Event.class, e.getSeq()).getStreamStatus()).isEqualTo(StreamStatus.LIVE);
    }

    @Test
    void stream_status_NULL_은_allowNull_일_때만_전이() {
        Event e = event("E1", null);
        em.flush();

        assertThat(eventRepository.transitStreamStatus(e.getSeq(),
                List.of(StreamStatus.SCHEDULED), false, StreamStatus.LIVE)).isEqualTo(0);
        assertThat(eventRepository.transitStreamStatus(e.getSeq(),
                List.of(StreamStatus.SCHEDULED), true, StreamStatus.LIVE)).isEqualTo(1);
    }
}
