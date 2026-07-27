package cloudsoswift.podoR.domain.seatview.ratelimit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** [ip:eventId:section] 1초 고정 윈도우 rate limit. */
@Component
@RequiredArgsConstructor
public class SeatViewRateLimiter {

    private final StringRedisTemplate redis;

    private static final int LIMIT_PER_SEC = 1;

    /** 허용되면 true. 윈도우 첫 요청에 1초 TTL 설정. */
    public boolean tryAcquire(String ip, String eventId, String section) {
        String key = "rl:" + ip + ":" + eventId + ":" + (section == null ? "ALL" : section);
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redis.expire(key, Duration.ofSeconds(1));
        }
        return count != null && count <= LIMIT_PER_SEC;
    }
}
