package cloudsoswift.podoR.domain.ticketing.hold;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 좌석 선점(hold)을 Redis 로 관리.
 * - hold:{eventSeatSeq} = userSeq (TTL 5분): 좌석 단위 소유권
 * - holds:user:{userSeq}:series:{seriesId}: 사용자·시리즈별 선점 좌석 집합(한도 집계용)
 * EventSeat.status 는 건드리지 않고 seat-view 에 오버레이된다.
 */
@Service
@RequiredArgsConstructor
public class SeatHoldService {

    private final StringRedisTemplate redis;

    private static final Duration TTL = Duration.ofMinutes(5);

    private static String holdKey(long seatSeq) { return "hold:" + seatSeq; }
    private static String seriesKey(long userSeq, String seriesId) {
        return "holds:user:" + userSeq + ":series:" + seriesId;
    }

    /**
     * seatSeqs 를 이 사용자로 일괄 선점(SETNX+TTL). 이미 본인 소유면 통과(멱등, TTL 갱신),
     * 타인 소유면 충돌. 하나라도 충돌이면 이번에 새로 획득한 것만 롤백 후 충돌 목록 반환(성공 시 빈 리스트).
     * AVAILABLE 여부(DB)는 호출부가 먼저 검사한다.
     */
    public List<Long> tryHoldAll(long userSeq, String seriesId, List<Long> seatSeqs) {
        List<Long> acquired = new ArrayList<>();
        List<Long> conflicts = new ArrayList<>();
        String me = String.valueOf(userSeq);
        for (Long seq : seatSeqs) {
            Boolean ok = redis.opsForValue().setIfAbsent(holdKey(seq), me, TTL);
            if (Boolean.TRUE.equals(ok)) {
                acquired.add(seq);
            } else if (me.equals(redis.opsForValue().get(holdKey(seq)))) {
                redis.expire(holdKey(seq), TTL); // 이미 본인 소유 → 멱등
            } else {
                conflicts.add(seq);
            }
        }
        if (!conflicts.isEmpty()) {
            for (Long seq : acquired) redis.delete(holdKey(seq));
            return conflicts;
        }
        String setKey = seriesKey(userSeq, seriesId);
        for (Long seq : seatSeqs) redis.opsForSet().add(setKey, String.valueOf(seq));
        redis.expire(setKey, TTL);
        return List.of();
    }

    /** 이 사용자가 해당 좌석들을 현재 선점 중인지(전부) — 결제 확정 재검증용. */
    public boolean ownsAll(long userSeq, List<Long> seatSeqs) {
        String me = String.valueOf(userSeq);
        for (Long seq : seatSeqs) {
            String owner = redis.opsForValue().get(holdKey(seq));
            if (owner == null || !owner.equals(me)) return false;
        }
        return true;
    }

    /** seatSeqs 중 이 사용자가 이미 선점(소유)한 좌석들 — 한도 중복집계 방지용. */
    public List<Long> ownedAmong(long userSeq, String seriesId, List<Long> seatSeqs) {
        String me = String.valueOf(userSeq);
        List<Long> owned = new ArrayList<>();
        for (Long seq : seatSeqs) {
            if (me.equals(redis.opsForValue().get(holdKey(seq)))) owned.add(seq);
        }
        return owned;
    }

    /**
     * 이 사용자가 해당 시리즈에서 현재 유효하게 선점 중인 좌석 수.
     * 집합 멤버 중 hold 키가 만료됐거나 소유자가 바뀐 것은 집합에서 제거(자가치유) 후 카운트.
     */
    public int heldCountInSeries(long userSeq, String seriesId) {
        String setKey = seriesKey(userSeq, seriesId);
        Set<String> members = redis.opsForSet().members(setKey);
        if (members == null || members.isEmpty()) return 0;
        String me = String.valueOf(userSeq);
        int count = 0;
        for (String m : members) {
            String owner = redis.opsForValue().get(holdKey(Long.parseLong(m)));
            if (me.equals(owner)) count++;
            else redis.opsForSet().remove(setKey, m); // 만료/소유변경 → 정리
        }
        return count;
    }

    /** 지정 좌석들의 선점 해제(+시리즈 집합에서 제거). */
    public void release(long userSeq, String seriesId, List<Long> seatSeqs) {
        String setKey = seriesKey(userSeq, seriesId);
        for (Long seq : seatSeqs) {
            redis.delete(holdKey(seq));
            redis.opsForSet().remove(setKey, String.valueOf(seq));
        }
    }

    /** 주어진 eventSeatSeq 중 현재 선점된 것들(seat-view 오버레이용). */
    public List<Long> heldAmong(List<Long> candidateSeatSeqs) {
        if (candidateSeatSeqs.isEmpty()) return List.of();
        List<String> keys = candidateSeatSeqs.stream().map(SeatHoldService::holdKey).collect(Collectors.toList());
        List<String> vals = redis.opsForValue().multiGet(keys);
        List<Long> held = new ArrayList<>();
        if (vals != null) {
            for (int i = 0; i < candidateSeatSeqs.size(); i++) {
                if (vals.get(i) != null) held.add(candidateSeatSeqs.get(i));
            }
        }
        return held;
    }
}
