package cloudsoswift.podoR.domain.queue;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.GenericContainer;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WaitingQueueService 를 실제 Redis(Testcontainers) 로 검증.
 * 스프링 컨텍스트 없이 수동 배선 — SeatHoldServiceIntegrationTest 와 같은 방식.
 * 컨테이너 수명은 @BeforeAll/@AfterAll 로 직접 관리(junit-jupiter 모듈 불필요).
 */
class WaitingQueueServiceIntegrationTest {

    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    static LettuceConnectionFactory connectionFactory;
    static StringRedisTemplate redis;

    WaitingQueueService service;

    static final String EVENT = "EVT1";

    @BeforeAll
    static void wire() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();
        redis = new StringRedisTemplate(connectionFactory);
        redis.afterPropertiesSet();
    }

    @AfterAll
    static void tearDown() {
        connectionFactory.destroy();
        REDIS.stop();
    }

    @BeforeEach
    void freshService() {
        try (RedisConnection conn = connectionFactory.getConnection()) {
            conn.serverCommands().flushAll();
        }
        service = newService(2, 60, 30); // 정원 2, 입장권 60초, 대기자 타임아웃 30초
    }

    /** @Value 필드는 수동 배선에서 주입되지 않으므로 리플렉션으로 채운다. */
    private static WaitingQueueService newService(int capacity, long passTtlSec, long waiterTimeoutSec) {
        WaitingQueueService s = new WaitingQueueService(redis);
        ReflectionTestUtils.setField(s, "capacity", capacity);
        ReflectionTestUtils.setField(s, "passTtlSeconds", passTtlSec);
        ReflectionTestUtils.setField(s, "waiterTimeoutSeconds", waiterTimeoutSec);
        return s;
    }

    @Test
    void 정원_이내면_즉시_입장하고_만료시각을_받는다() {
        QueueSnapshot s = service.enterOrPoll(EVENT, 1L);

        assertThat(s.status()).isEqualTo(QueueStatus.ADMITTED);
        assertThat(s.passExpiresAt()).isNotNull().isAfter(java.time.LocalDateTime.now());
        assertThat(redis.opsForZSet().score("wq:active:EVT1", "1")).isNotNull();
        assertThat(redis.opsForZSet().score("wq:wait:EVT1", "1")).isNull();
    }

    @Test
    void 정원을_넘으면_대기하고_ahead_가_앞_인원을_가리킨다() {
        service.enterOrPoll(EVENT, 1L);
        service.enterOrPoll(EVENT, 2L); // 여기까지 정원 2 소진

        QueueSnapshot third = service.enterOrPoll(EVENT, 3L);
        QueueSnapshot fourth = service.enterOrPoll(EVENT, 4L);

        assertThat(third.status()).isEqualTo(QueueStatus.WAITING);
        assertThat(third.ahead()).isZero();          // 대기열 맨 앞
        assertThat(third.passExpiresAt()).isNull();
        assertThat(fourth.status()).isEqualTo(QueueStatus.WAITING);
        assertThat(fourth.ahead()).isEqualTo(1L);    // 3번이 앞에 있다
    }

    @Test
    void 이미_입장한_사용자의_재요청은_멱등이고_만료시각을_연장하지_않는다() {
        QueueSnapshot first = service.enterOrPoll(EVENT, 1L);
        Double expiryAfterFirst = redis.opsForZSet().score("wq:active:EVT1", "1");

        QueueSnapshot again = service.enterOrPoll(EVENT, 1L);

        assertThat(again.status()).isEqualTo(QueueStatus.ADMITTED);
        assertThat(again.passExpiresAt()).isEqualTo(first.passExpiresAt());
        // 고정 시간 입장권 — 폴링해도 연장되지 않는다
        assertThat(redis.opsForZSet().score("wq:active:EVT1", "1")).isEqualTo(expiryAfterFirst);
        assertThat(redis.opsForZSet().zCard("wq:active:EVT1")).isEqualTo(1L);
    }

    @Test
    void 입장권이_만료되면_자가치유로_제거되고_대기자가_승격한다() {
        service.enterOrPoll(EVENT, 1L);
        service.enterOrPoll(EVENT, 2L);
        QueueSnapshot waiting = service.enterOrPoll(EVENT, 3L);
        assertThat(waiting.status()).isEqualTo(QueueStatus.WAITING);

        // 1번의 입장권을 과거로 밀어 만료 시뮬레이션
        redis.opsForZSet().add("wq:active:EVT1", "1", 1.0);

        QueueSnapshot promoted = service.enterOrPoll(EVENT, 3L);

        assertThat(promoted.status()).isEqualTo(QueueStatus.ADMITTED);
        assertThat(redis.opsForZSet().score("wq:active:EVT1", "1")).isNull(); // 만료분 제거됨
        assertThat(redis.opsForZSet().zCard("wq:active:EVT1")).isEqualTo(2L); // 2번, 3번
    }

    @Test
    void 폴링을_멈춘_대기자는_정리되고_뒷사람이_앞으로_당겨진다() {
        service.enterOrPoll(EVENT, 1L);
        service.enterOrPoll(EVENT, 2L);
        service.enterOrPoll(EVENT, 3L); // 대기 0번째
        QueueSnapshot fourth = service.enterOrPoll(EVENT, 4L);
        assertThat(fourth.ahead()).isEqualTo(1L);

        // 3번의 하트비트를 타임아웃 이전으로 밀어 이탈 시뮬레이션
        redis.opsForZSet().add("wq:hb:EVT1", "3", 1.0);

        QueueSnapshot afterSweep = service.enterOrPoll(EVENT, 4L);

        assertThat(afterSweep.status()).isEqualTo(QueueStatus.WAITING);
        assertThat(afterSweep.ahead()).isZero(); // 3번이 정리되어 4번이 맨 앞
        assertThat(redis.opsForZSet().score("wq:wait:EVT1", "3")).isNull();
    }

    @Test
    void leave_는_대기_하트비트_입장권_세곳_모두에서_제거한다() {
        service.enterOrPoll(EVENT, 1L);   // ADMITTED
        service.enterOrPoll(EVENT, 2L);   // ADMITTED
        service.enterOrPoll(EVENT, 3L);   // WAITING

        service.leave(EVENT, 1L);
        service.leave(EVENT, 3L);

        assertThat(redis.opsForZSet().score("wq:active:EVT1", "1")).isNull();
        assertThat(redis.opsForZSet().score("wq:wait:EVT1", "3")).isNull();
        assertThat(redis.opsForZSet().score("wq:hb:EVT1", "3")).isNull();
        // 반납된 슬롯으로 다음 사람이 들어온다
        assertThat(service.enterOrPoll(EVENT, 4L).status()).isEqualTo(QueueStatus.ADMITTED);
    }

    @Test
    void hasValidPass_는_활성_입장권만_참이고_만료분은_거짓이다() {
        service.enterOrPoll(EVENT, 1L);
        service.enterOrPoll(EVENT, 2L);
        service.enterOrPoll(EVENT, 3L); // WAITING

        assertThat(service.hasValidPass(EVENT, 1L)).isTrue();
        assertThat(service.hasValidPass(EVENT, 3L)).isFalse(); // 대기 중은 입장권 없음
        assertThat(service.hasValidPass(EVENT, 99L)).isFalse();

        redis.opsForZSet().add("wq:active:EVT1", "1", 1.0); // 과거로 밀어 만료
        assertThat(service.hasValidPass(EVENT, 1L)).isFalse();
    }

    @Test
    void 큐_키에는_만료가_설정되어_지난_이벤트가_영구히_남지_않는다() {
        service.enterOrPoll(EVENT, 1L);
        service.enterOrPoll(EVENT, 2L);
        service.enterOrPoll(EVENT, 3L); // wait/hb 까지 채운다

        // passTtl 60초 → keyTtl 은 그 2배인 120초
        assertThat(redis.getExpire("wq:active:EVT1")).isBetween(100L, 120L);
        assertThat(redis.getExpire("wq:wait:EVT1")).isBetween(100L, 120L);
        assertThat(redis.getExpire("wq:hb:EVT1")).isBetween(100L, 120L);
        assertThat(redis.getExpire("wq:seq:EVT1")).isBetween(100L, 120L);
    }

    @Test
    void 동시에_몰려도_정원을_초과해_입장시키지_않는다() throws Exception {
        WaitingQueueService s = newService(10, 60, 30);
        int threads = 100;
        ExecutorService pool = Executors.newFixedThreadPool(16);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger admitted = new AtomicInteger();
        List<Throwable> errors = new ArrayList<>();

        for (int i = 1; i <= threads; i++) {
            long userSeq = i;
            pool.submit(() -> {
                try {
                    start.await();
                    if (s.enterOrPoll(EVENT, userSeq).status() == QueueStatus.ADMITTED) {
                        admitted.incrementAndGet();
                    }
                } catch (Throwable t) {
                    synchronized (errors) { errors.add(t); }
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
        pool.shutdownNow();

        assertThat(errors).isEmpty();
        assertThat(admitted.get()).isEqualTo(10);
        assertThat(redis.opsForZSet().zCard("wq:active:EVT1")).isEqualTo(10L);
        assertThat(redis.opsForZSet().zCard("wq:wait:EVT1")).isEqualTo(90L);
    }
}
