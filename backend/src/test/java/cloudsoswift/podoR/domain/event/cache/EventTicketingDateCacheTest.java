package cloudsoswift.podoR.domain.event.cache;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventTicketingDateCacheTest {

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> valueOps;

    @InjectMocks EventTicketingDateCache cache;

    static final String KEY = "event:ticketingDate:EVT1";
    static final LocalDateTime TICKETING_DATE = LocalDateTime.of(2026, 10, 3, 19, 0);

    @Test
    void 저장은_5분_TTL_과_함께_이루어진다() {
        when(redis.opsForValue()).thenReturn(valueOps);

        cache.put("EVT1", TICKETING_DATE);

        verify(valueOps).set(KEY, "2026-10-03T19:00", Duration.ofMinutes(5));
    }

    @Test
    void 저장된_값은_그대로_읽힌다() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(KEY)).thenReturn("2026-10-03T19:00");

        assertThat(cache.get("EVT1")).contains(TICKETING_DATE);
    }

    @Test
    void 값이_없으면_빈_값() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(KEY)).thenReturn(null);

        assertThat(cache.get("EVT1")).isEmpty();
    }

    /**
     * 캐시 실패를 미스로 처리해, 호출부가 DB로 폴백하도록 유도.
     * 위 로직이 작동해야, Redis가 없는 환경(테스트 등)에서도 대기열 API가 동작 할 수 있음.
     */
    @Test
    void Redis_에_문제가_있으면_예외를_던지지_않고_빈_값을_돌려준다() {
        when(redis.opsForValue()).thenThrow(new RuntimeException("connection refused"));

        assertThat(cache.get("EVT1")).isEmpty();
    }

    @Test
    void 깨진_값이_들어있어도_빈_값을_돌려준다() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(KEY)).thenReturn("not-a-datetime");

        assertThat(cache.get("EVT1")).isEmpty();
    }

    @Test
    void 무효화는_키를_지운다() {
        cache.evict("EVT1");

        verify(redis).delete(KEY);
    }
}
