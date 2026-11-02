package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.dto.PublishAuthRequest;
import cloudsoswift.podoR.domain.stream.dto.StreamStartedResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.policy.StreamPublishPolicy;
import cloudsoswift.podoR.domain.stream.vod.VodRequester;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 상태 전이가 조건부 UPDATE 로 이뤄지므로 실제 JPA 위에서 검증한다. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({StreamLifecycleService.class, StreamLifecycleServiceTest.Config.class})
class StreamLifecycleServiceTest {

    @TestConfiguration
    static class Config {
        @Bean
        StreamProperties streamProperties() {
            return new StreamProperties("rtmp://h/live", 1, Duration.ofMinutes(3), "tok", "sec", "/media");
        }
    }

    @Autowired TestEntityManager em;
    @Autowired StreamLifecycleService service;
    @MockitoBean StreamPublishPolicy policy;
    @MockitoBean VodRequester vodRequester;

    User host;
    Venue venue;
    final LocalDateTime now = LocalDateTime.of(2026, 11, 2, 20, 0);

    @BeforeEach
    void setUp() {
        host = em.persist(EntityFixtures.user("h"));
        venue = em.persist(EntityFixtures.venue("v"));
        when(policy.allows(any(), any())).thenReturn(true);
    }

    private Event event(String id, String key, StreamStatus status) {
        Event e = em.persist(Event.builder().host(host).venue(venue).eventId(id).seriesId("S")
                .title("t").eventType("CONCERT").eventDate(now).ticketingDate(now)
                .streamKey(key).streamStatus(status).build());
        em.flush();
        return e;
    }

    private static PublishAuthRequest publish(String path) {
        return new PublishAuthRequest(null, null, "100.64.0.5", "publish", path, "rtmp", "id", "");
    }

    private StreamStatus statusOf(Event e) {
        em.clear();
        return em.find(Event.class, e.getSeq()).getStreamStatus();
    }

    // ===== publish-auth =====

    @Test
    void SCHEDULED_회차의_키로_publish_하면_허가() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);
        assertThat(service.authorize(publish("live/KEY1"), now)).isTrue();
    }

    @Test
    void stream_status_NULL_회차도_허가() {
        event("E1", "KEY1", null);
        assertThat(service.authorize(publish("live/KEY1"), now)).isTrue();
    }

    @Test
    void ENDED_회차는_거부() {
        event("E1", "KEY1", StreamStatus.ENDED);
        assertThat(service.authorize(publish("live/KEY1"), now)).isFalse();
    }

    @Test
    void 모르는_키는_거부() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);
        assertThat(service.authorize(publish("live/NOPE"), now)).isFalse();
        assertThat(service.authorize(publish("other/KEY1"), now)).isFalse();
    }

    @Test
    void 다른_회차가_INTERRUPTED_면_max_concurrent_1_에서_거부() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);
        event("E2", "KEY2", StreamStatus.INTERRUPTED);
        assertThat(service.authorize(publish("live/KEY1"), now)).isFalse();
        // 끊긴 회차 자신은 재접속할 수 있어야 한다
        assertThat(service.authorize(publish("live/KEY2"), now)).isTrue();
    }

    @Test
    void 정책이_거부하면_거부() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);
        when(policy.allows(any(), any())).thenReturn(false);
        assertThat(service.authorize(publish("live/KEY1"), now)).isFalse();
    }

    @Test
    void read_는_localhost_만_허가() {
        event("E1", "KEY1", StreamStatus.LIVE);
        PublishAuthRequest local = new PublishAuthRequest(null, null, "127.0.0.1", "read", "live/KEY1", "rtmp", "id", "");
        PublishAuthRequest remote = new PublishAuthRequest(null, null, "100.64.0.5", "read", "live/KEY1", "rtmp", "id", "");
        PublishAuthRequest other = new PublishAuthRequest(null, null, "127.0.0.1", "playback", "live/KEY1", "rtmp", "id", "");
        assertThat(service.authorize(local, now)).isTrue();
        assertThat(service.authorize(remote, now)).isFalse();
        assertThat(service.authorize(other, now)).isFalse();
    }

    // ===== started / stopped =====

    @Test
    void started_는_LIVE_로_바꾸고_세션_1_과_출력_폴더를_준다() {
        Event e = event("E1", "KEY1", StreamStatus.SCHEDULED);

        StreamStartedResponse res = service.started("KEY1", now);

        assertThat(res.eventId()).isEqualTo("E1");
        assertThat(res.sessionNo()).isEqualTo(1);
        assertThat(res.outputDir()).isEqualTo("/media/hls/E1/1");
        assertThat(statusOf(e)).isEqualTo(StreamStatus.LIVE);
    }

    @Test
    void 끊겼다_다시_started_하면_세션_2() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);
        service.started("KEY1", now);
        service.stopped("KEY1", now.plusMinutes(10));

        StreamStartedResponse res = service.started("KEY1", now.plusMinutes(11));

        assertThat(res.sessionNo()).isEqualTo(2);
        assertThat(res.outputDir()).isEqualTo("/media/hls/E1/2");
    }

    @Test
    void LIVE_로_남은_회차에_다시_송출하면_허가하고_새_세션으로_이어간다() {
        // Spring 재기동 중 OBS 가 끊겨 stopped 가 유실되면 LIVE 로 남는다. MediaMTX 는 같은 경로에
        // 송출자를 둘 받지 않으므로, LIVE 회차에 새 publish 가 왔다면 이전 송출은 이미 끊긴 것이다.
        Event e = event("E1", "KEY1", StreamStatus.SCHEDULED);
        service.started("KEY1", now);

        assertThat(service.authorize(publish("live/KEY1"), now.plusMinutes(5))).isTrue();
        StreamStartedResponse res = service.started("KEY1", now.plusMinutes(5));

        assertThat(res.sessionNo()).isEqualTo(2);
        // statusOf 가 영속성 컨텍스트를 비우므로 세션 확인(자동 flush)을 먼저 한다
        List<StreamSession> sessions = em.getEntityManager()
                .createQuery("SELECT s FROM StreamSession s ORDER BY s.sessionNo", StreamSession.class).getResultList();
        assertThat(sessions.get(0).getEndedAt()).isEqualTo(now.plusMinutes(5));
        assertThat(statusOf(e)).isEqualTo(StreamStatus.LIVE);
    }

    @Test
    void ENDED_에서_started_는_409() {
        event("E1", "KEY1", StreamStatus.ENDED);
        assertThatThrownBy(() -> service.started("KEY1", now))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void stopped_는_세션을_닫고_INTERRUPTED() {
        Event e = event("E1", "KEY1", StreamStatus.SCHEDULED);
        service.started("KEY1", now);

        service.stopped("KEY1", now.plusMinutes(5));

        assertThat(statusOf(e)).isEqualTo(StreamStatus.INTERRUPTED);
        List<StreamSession> sessions = em.getEntityManager()
                .createQuery("SELECT s FROM StreamSession s", StreamSession.class).getResultList();
        assertThat(sessions).singleElement().extracting(StreamSession::getEndedAt).isEqualTo(now.plusMinutes(5));
        verifyNoInteractions(vodRequester);
    }

    // ===== 종료 =====

    private Event interruptedSince(String id, String key, LocalDateTime endedAt) {
        Event e = event(id, key, StreamStatus.INTERRUPTED);
        StreamSession s = StreamSession.start(e, 1, endedAt.minusMinutes(30));
        s.end(endedAt);
        em.persist(s);
        em.flush();
        return e;
    }

    @Test
    void INTERRUPTED_에서_종료하면_ENDED_와_VOD_요청() {
        Event e = interruptedSince("E1", "KEY1", now.minusMinutes(1));

        service.endByHost("E1");

        assertThat(statusOf(e)).isEqualTo(StreamStatus.ENDED);
        verify(vodRequester).requestBuild(e.getSeq());
    }

    @Test
    void LIVE_에서_종료하면_ENDED_이고_VOD_는_아직() {
        Event e = event("E1", "KEY1", StreamStatus.LIVE);

        service.endByHost("E1");

        assertThat(statusOf(e)).isEqualTo(StreamStatus.ENDED);
        verifyNoInteractions(vodRequester);
    }

    @Test
    void SCHEDULED_에서_종료하면_409() {
        event("E1", "KEY1", StreamStatus.SCHEDULED);

        assertThatThrownBy(() -> service.endByHost("E1"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void 유예_3분이_지난_INTERRUPTED_만_ENDED() {
        Event old = interruptedSince("OLD", "K1", now.minusMinutes(4));
        Event recent = interruptedSince("RECENT", "K2", now.minusMinutes(1));

        int ended = service.endExpired(now);

        assertThat(ended).isEqualTo(1);
        assertThat(statusOf(old)).isEqualTo(StreamStatus.ENDED);
        assertThat(statusOf(recent)).isEqualTo(StreamStatus.INTERRUPTED);
        verify(vodRequester).requestBuild(old.getSeq());
        verify(vodRequester, never()).requestBuild(recent.getSeq());
    }

    @Test
    void 유예_만료와_재접속이_겹치면_한쪽만_성공() {
        Event e = interruptedSince("E1", "KEY1", now.minusMinutes(4));
        service.started("KEY1", now);

        int ended = service.endExpired(now);

        assertThat(ended).isZero();
        assertThat(statusOf(e)).isEqualTo(StreamStatus.LIVE);
        verifyNoInteractions(vodRequester);
    }

    @Test
    void ENDED_상태에서_stopped_가_오면_VOD_요청_1회() {
        Event e = event("E1", "KEY1", StreamStatus.SCHEDULED);
        service.started("KEY1", now);
        em.getEntityManager().createQuery("UPDATE Event e SET e.streamStatus = :s WHERE e.seq = :seq")
                .setParameter("s", StreamStatus.ENDED).setParameter("seq", e.getSeq()).executeUpdate();

        service.stopped("KEY1", now.plusMinutes(5));

        verify(vodRequester, times(1)).requestBuild(e.getSeq());
        assertThat(statusOf(e)).isEqualTo(StreamStatus.ENDED);
    }
}
