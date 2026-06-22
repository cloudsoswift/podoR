package cloudsoswift.podoR.common.seat;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Event 단위로 단조증가하는 좌석 변경 시퀀스를 발급한다(Redis INCR).
 * EventSeat.changeVersion 에 부여해 증분 조회(change_version > since)의 커서로 쓴다.
 */
@Component
@RequiredArgsConstructor
public class SeatVersionGenerator {

    private final StringRedisTemplate redis;

    private static String key(Long eventSeq) {
        return "seatver:" + eventSeq;
    }

    /** 다음 단조 시퀀스 1개. */
    public long next(Long eventSeq) {
        Long v = redis.opsForValue().increment(key(eventSeq));
        return v != null ? v : 1L;
    }

    /** 여러 개를 한 번에 증가시키고 마지막 값을 반환(루프 시작점은 last-(count-1)). */
    public long advance(Long eventSeq, long count) {
        Long v = redis.opsForValue().increment(key(eventSeq), count);
        return v != null ? v : count;
    }
}
