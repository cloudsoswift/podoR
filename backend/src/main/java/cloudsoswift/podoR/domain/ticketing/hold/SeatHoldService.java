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
 * 좌석 선점(hold)을 Redis 로 관리. 키 hold:{eventSeatSeq}=userSeq (TTL 5분),
 * 사용자 보유 집합 holds:user:{userSeq}. EventSeat.status 는 건드리지 않고 seat-view 에 오버레이된다.
 */
@Service
@RequiredArgsConstructor
public class SeatHoldService {

    private final StringRedisTemplate redis;

    private static final Duration TTL = Duration.ofMinutes(5);

    private static String holdKey(long seatSeq) { return "hold:" + seatSeq; }
    private static String userKey(long userSeq) { return "holds:user:" + userSeq; }

    /**
     * seatSeqs 를 이 사용자로 일괄 선점(SETNX+TTL). 하나라도 이미 선점돼 있으면 확보분 전량 롤백 후
     * 충돌 좌석 목록을 반환한다(성공 시 빈 리스트). AVAILABLE 여부(DB)는 호출부가 먼저 검사한다.
     */
    public List<Long> tryHoldAll(long userSeq, List<Long> seatSeqs) {
        List<Long> acquired = new ArrayList<>();
        List<Long> conflicts = new ArrayList<>();
        for (Long seq : seatSeqs) {
            Boolean ok = redis.opsForValue().setIfAbsent(holdKey(seq), String.valueOf(userSeq), TTL);
            if (Boolean.TRUE.equals(ok)) {
                acquired.add(seq);
            } else {
                conflicts.add(seq);
            }
        }
        if (!conflicts.isEmpty()) {
            for (Long seq : acquired) redis.delete(holdKey(seq));
            return conflicts;
        }
        for (Long seq : acquired) redis.opsForSet().add(userKey(userSeq), String.valueOf(seq));
        redis.expire(userKey(userSeq), TTL);
        return List.of();
    }

    /** 이 사용자가 해당 좌석들을 현재 선점 중인지(전부) — 결제 확정 재검증용. */
    public boolean ownsAll(long userSeq, List<Long> seatSeqs) {
        for (Long seq : seatSeqs) {
            String owner = redis.opsForValue().get(holdKey(seq));
            if (owner == null || !owner.equals(String.valueOf(userSeq))) return false;
        }
        return true;
    }

    /** 지정 좌석들의 선점 해제(+사용자 집합에서 제거). */
    public void release(long userSeq, List<Long> seatSeqs) {
        for (Long seq : seatSeqs) {
            redis.delete(holdKey(seq));
            redis.opsForSet().remove(userKey(userSeq), String.valueOf(seq));
        }
    }

    /** 이 사용자의 모든 선점 해제(새 체크아웃 시작 시 이전 것 무효화). */
    public void releaseAll(long userSeq) {
        Set<String> seqs = redis.opsForSet().members(userKey(userSeq));
        if (seqs != null) {
            for (String s : seqs) redis.delete(holdKey(Long.parseLong(s)));
        }
        redis.delete(userKey(userSeq));
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
