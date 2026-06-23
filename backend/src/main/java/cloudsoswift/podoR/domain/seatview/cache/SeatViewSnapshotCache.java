package cloudsoswift.podoR.domain.seatview.cache;

import cloudsoswift.podoR.domain.seatview.dto.SeatViewResponse;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/** seat-view 전체 스냅샷을 event별 TTL 로 Redis 에 캐싱. since=0/풀 요청을 캐시에서 제공. */
@Component
@RequiredArgsConstructor
public class SeatViewSnapshotCache {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    private static final Duration TTL = Duration.ofSeconds(30);

    private static String key(String eventId) {
        return "seatview:snapshot:" + eventId;
    }

    public Optional<SeatViewResponse> get(String eventId) {
        String json = redis.opsForValue().get(key(eventId));
        if (json == null) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(json, SeatViewResponse.class));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public void put(SeatViewResponse snapshot) {
        try {
            redis.opsForValue().set(key(snapshot.eventId()),
                    objectMapper.writeValueAsString(snapshot), TTL);
        } catch (Exception ignored) {
            // 캐시 실패는 무시(다음 요청이 DB 로 폴백)
        }
    }

    public void evict(String eventId) {
        redis.delete(key(eventId));
    }
}
