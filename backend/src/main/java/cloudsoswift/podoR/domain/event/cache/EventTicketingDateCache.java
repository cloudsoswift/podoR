package cloudsoswift.podoR.domain.event.cache;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 대기열 폴링(POST /queue) 조회에서 실질적으로 유효한 값인 `이벤트의 티켓팅 시각(ticketingDate)`을
 * event별로 Redis에 캐싱하는 클래스.
 *
 * 값이 바뀌는 시점(이벤트 수정/삭제)에 evict(제거) 하는 것이 주 메커니즘이고,
 * TTL 은 evict 작업이 유실됐을 때를 위한 안전망임.
 */
@Component
@RequiredArgsConstructor
public class EventTicketingDateCache {

    private final StringRedisTemplate redis;

    static final Duration TTL = Duration.ofMinutes(5);

    private static String key(String eventId) {
        return "event:ticketingDate:" + eventId;
    }

    /**
     * 캐시된 티켓팅 시각. 값이 없거나 Redis에 문제가 있으면 빈 값을 반환.
     *
     * 이때, 캐시 실패를 미스로 처리하여야, 호출부(`enterOrPoll`)가 DB로 폴백해 Redis가 없는 환경(테스트 등)에서도 정상 동작함.
     */
    public Optional<LocalDateTime> get(String eventId) {
        try {
            String value = redis.opsForValue().get(key(eventId));
            return value == null ? Optional.empty() : Optional.of(LocalDateTime.parse(value));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public void put(String eventId, LocalDateTime ticketingDate) {
        try {
            redis.opsForValue().set(key(eventId), ticketingDate.toString(), TTL);
        } catch (Exception ignored) {
            // 캐시 실패는 무시(다음 요청이 DB로 폴백)
        }
    }

    public void evict(String eventId) {
        try {
            redis.delete(key(eventId));
        } catch (Exception ignored) {
            // 무효화 실패는 결국에 TTL이 지나고 회수함.
        }
    }
}
