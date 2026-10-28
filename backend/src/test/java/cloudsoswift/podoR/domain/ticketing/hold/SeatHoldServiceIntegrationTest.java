package cloudsoswift.podoR.domain.ticketing.hold;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SeatHoldService 를 실제 Redis(Testcontainers) 로 검증. 스프링 컨텍스트 없이 수동 배선(접근법 ①).
 * 컨테이너 수명은 @BeforeAll/@AfterAll 로 직접 관리(junit-jupiter 모듈 불필요).
 */
class SeatHoldServiceIntegrationTest {

    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    static LettuceConnectionFactory connectionFactory;
    static StringRedisTemplate redis;
    static SeatHoldService service;

    static final long USER = 100L;
    static final long OTHER = 200L;
    static final String SERIES = "S1";

    @BeforeAll
    static void wire() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();
        redis = new StringRedisTemplate(connectionFactory);
        redis.afterPropertiesSet();
        service = new SeatHoldService(redis);
    }

    @AfterAll
    static void tearDown() {
        connectionFactory.destroy();
        REDIS.stop();
    }

    @BeforeEach
    void flush() {
        try (RedisConnection conn = connectionFactory.getConnection()) {
            conn.serverCommands().flushAll();
        }
    }

    @Test
    void tryHoldAll_정상이면_충돌없이_키와_시리즈집합에_기록() {
        List<Long> conflicts = service.tryHoldAll(USER, SERIES, List.of(1L, 2L, 3L));

        assertThat(conflicts).isEmpty();
        assertThat(redis.hasKey("hold:1")).isTrue();
        assertThat(redis.hasKey("hold:2")).isTrue();
        assertThat(redis.opsForSet().members("holds:user:100:series:S1"))
                .containsExactlyInAnyOrder("1", "2", "3");
    }

    @Test
    void tryHoldAll_일부가_타인소유면_전량롤백하고_충돌반환() {
        service.tryHoldAll(OTHER, SERIES, List.of(2L)); // 2번을 타인이 선점

        List<Long> conflicts = service.tryHoldAll(USER, SERIES, List.of(1L, 2L, 3L));

        assertThat(conflicts).containsExactly(2L);
        // 이번에 새로 확보하려던 1,3 은 롤백되어 생성되지 않아야 함
        assertThat(redis.hasKey("hold:1")).isFalse();
        assertThat(redis.hasKey("hold:3")).isFalse();
        // 2번은 여전히 타인 소유
        assertThat(redis.opsForValue().get("hold:2")).isEqualTo(String.valueOf(OTHER));
    }

    @Test
    void tryHoldAll_이미_본인소유_좌석포함_재선점은_멱등통과() {
        service.tryHoldAll(USER, SERIES, List.of(1L));

        List<Long> conflicts = service.tryHoldAll(USER, SERIES, List.of(1L, 2L));

        assertThat(conflicts).isEmpty();
        assertThat(redis.opsForValue().get("hold:1")).isEqualTo(String.valueOf(USER));
        assertThat(redis.opsForValue().get("hold:2")).isEqualTo(String.valueOf(USER));
    }

    @Test
    void heldCountInSeries_만료된_멤버는_자가치유로_제외되고_집합에서_제거() {
        service.tryHoldAll(USER, SERIES, List.of(1L, 2L, 3L));
        // 2번 hold 키만 만료(수동 삭제)로 시뮬레이션 — 집합 멤버는 남아 있음
        redis.delete("hold:2");

        int count = service.heldCountInSeries(USER, SERIES);

        assertThat(count).isEqualTo(2);
        assertThat(redis.opsForSet().members("holds:user:100:series:S1"))
                .containsExactlyInAnyOrder("1", "3");
    }

    @Test
    void release_지정좌석의_키와_시리즈집합멤버를_동시제거() {
        service.tryHoldAll(USER, SERIES, List.of(1L, 2L, 3L));

        service.release(USER, SERIES, List.of(2L));

        assertThat(redis.hasKey("hold:2")).isFalse();
        assertThat(redis.opsForSet().members("holds:user:100:series:S1"))
                .containsExactlyInAnyOrder("1", "3");
        assertThat(redis.hasKey("hold:1")).isTrue();
    }

    @Test
    void ownsAll_과_ownedAmong_소유판정() {
        service.tryHoldAll(USER, SERIES, List.of(1L, 2L));

        assertThat(service.ownsAll(USER, List.of(1L, 2L))).isTrue();
        assertThat(service.ownsAll(USER, List.of(1L, 9L))).isFalse();
        assertThat(service.ownedAmong(USER, SERIES, List.of(1L, 2L, 9L)))
                .containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void heldAmong_후보중_현재선점된것만_반환() {
        service.tryHoldAll(USER, SERIES, List.of(1L, 3L));

        assertThat(service.heldAmong(List.of(1L, 2L, 3L, 4L)))
                .containsExactlyInAnyOrder(1L, 3L);
    }
}
