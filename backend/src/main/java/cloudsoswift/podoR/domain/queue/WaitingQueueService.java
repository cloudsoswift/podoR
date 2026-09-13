package cloudsoswift.podoR.domain.queue;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * 가상 대기실의 Redis 기계장치. 정책(오픈 시각 등)은 다루지 않는다 — TicketingQueueService 참고.
 *
 * - wq:wait:{eventId}   ZSET  member=userSeq, score=순번        → ZRANK 가 내 앞 인원
 * - wq:hb:{eventId}     ZSET  member=userSeq, score=마지막 폴링  → 대기자 생존 확인
 * - wq:active:{eventId} ZSET  member=userSeq, score=입장권 만료  → ZCARD 가 현재 입장 인원
 * - wq:seq:{eventId}    String(INCR) 순번 발급기
 *
 * 승격은 단일 Lua 스크립트로 원자 실행한다. 폴링이 동시에 몰려도 정원을 넘지 않는 이유가 여기에 있다.
 * (현재 Redis 는 단일 인스턴스다. 훗날 클러스터로 가면 네 키에 hash tag 가 필요하다.)
 */
@Service
@RequiredArgsConstructor
public class WaitingQueueService {

    private final StringRedisTemplate redis;

    @Value("${queue.capacity:100}")
    private int capacity;

    @Value("${queue.pass-ttl-seconds:900}")
    private long passTtlSeconds;

    @Value("${queue.waiter-timeout-seconds:15}")
    private long waiterTimeoutSeconds;

    private static String waitKey(String eventId)   { return "wq:wait:" + eventId; }
    private static String hbKey(String eventId)     { return "wq:hb:" + eventId; }
    private static String activeKey(String eventId) { return "wq:active:" + eventId; }
    private static String seqKey(String eventId)    { return "wq:seq:" + eventId; }

    /**
     * KEYS: wait, hb, active, seq
     * ARGV: userSeq, now(ms), capacity, passTtlMs, waiterTimeoutMs, keyTtlSec
     * 반환: { status, passExpiresAtMs, ahead }  — 전부 문자열
     *
     * 큰 정수를 tostring() 으로 만들면 Lua 5.1 이 지수 표기로 바꿀 수 있어 string.format('%d') 을 쓴다.
     */
    private static final RedisScript<List> PROMOTE = new DefaultRedisScript<>("""
            local me = ARGV[1]
            local now = tonumber(ARGV[2])
            local capacity = tonumber(ARGV[3])
            local passTtl = tonumber(ARGV[4])
            local waiterTimeout = tonumber(ARGV[5])
            local keyTtl = tonumber(ARGV[6])

            -- 1. 만료된 입장권 반납(자가치유)
            redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)

            -- 2. 폴링이 끊긴 대기자 정리 — 없으면 맨 앞 사람이 창을 닫았을 때 뒤가 영구히 막힌다
            local dead = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', now - waiterTimeout)
            for i = 1, #dead do
                redis.call('ZREM', KEYS[2], dead[i])
                redis.call('ZREM', KEYS[1], dead[i])
            end

            local result
            local exp = redis.call('ZSCORE', KEYS[3], me)
            if exp then
                -- 3. 이미 입장 중 — 멱등. 고정 시간 입장권이므로 만료시각을 연장하지 않는다.
                result = { 'ADMITTED', string.format('%d', tonumber(exp)), '0' }
            else
                -- 4. 대기열에 없으면 순번을 받아 등록
                if not redis.call('ZSCORE', KEYS[1], me) then
                    local ticket = redis.call('INCR', KEYS[4])
                    redis.call('ZADD', KEYS[1], ticket, me)
                end
                -- 5. 하트비트 갱신 — 대기 중에는 이 폴링이 곧 생존 신호다
                redis.call('ZADD', KEYS[2], now, me)

                -- 6. 승격 판정
                local free = capacity - redis.call('ZCARD', KEYS[3])
                local rank = redis.call('ZRANK', KEYS[1], me)
                if free > 0 and rank < free then
                    redis.call('ZREM', KEYS[1], me)
                    redis.call('ZREM', KEYS[2], me)
                    local expiresAt = now + passTtl
                    redis.call('ZADD', KEYS[3], expiresAt, me)
                    result = { 'ADMITTED', string.format('%d', expiresAt), '0' }
                else
                    result = { 'WAITING', '0', string.format('%d', rank) }
                end
            end

            -- 7. 키 회수 — 큐가 활동 중이면 갱신되고, 러시가 끝나면 통째로 사라진다
            redis.call('EXPIRE', KEYS[1], keyTtl)
            redis.call('EXPIRE', KEYS[2], keyTtl)
            redis.call('EXPIRE', KEYS[3], keyTtl)
            redis.call('EXPIRE', KEYS[4], keyTtl)

            return result
            """, List.class);

    /** 대기·하트비트·입장권 세 곳에서 모두 제거. 이탈과 주문 완료 반납 양쪽에 쓴다. */
    private static final RedisScript<Long> LEAVE = new DefaultRedisScript<>("""
            redis.call('ZREM', KEYS[1], ARGV[1])
            redis.call('ZREM', KEYS[2], ARGV[1])
            redis.call('ZREM', KEYS[3], ARGV[1])
            return 1
            """, Long.class);

    /**
     * 등록 + 하트비트 + 승격 시도 + 상태 조회를 한 번에(멱등). 대기 화면의 폴링이 이걸 호출한다.
     */
    @SuppressWarnings("unchecked")
    public QueueSnapshot enterOrPoll(String eventId, long userSeq) {
        long now = System.currentTimeMillis();
        List<String> raw = redis.execute(PROMOTE,
                List.of(waitKey(eventId), hbKey(eventId), activeKey(eventId), seqKey(eventId)),
                String.valueOf(userSeq),
                String.valueOf(now),
                String.valueOf(capacity),
                String.valueOf(passTtlSeconds * 1000),
                String.valueOf(waiterTimeoutSeconds * 1000),
                String.valueOf(passTtlSeconds * 2));

        if ("ADMITTED".equals(raw.get(0))) {
            return new QueueSnapshot(QueueStatus.ADMITTED, 0L, toLocalDateTime(Long.parseLong(raw.get(1))));
        }
        return new QueueSnapshot(QueueStatus.WAITING, Long.parseLong(raw.get(2)), null);
    }

    /** 이탈 또는 슬롯 반납. 대기 중이었는지 입장 중이었는지 호출부가 알 필요 없다. */
    public void leave(String eventId, long userSeq) {
        redis.execute(LEAVE,
                List.of(waitKey(eventId), hbKey(eventId), activeKey(eventId)),
                String.valueOf(userSeq));
    }

    /** 유효한 입장권 보유 여부. 게이트(QueuePassInterceptor)가 쓴다 — 여기서 승격하지 않는다. */
    public boolean hasValidPass(String eventId, long userSeq) {
        Double expiresAt = redis.opsForZSet().score(activeKey(eventId), String.valueOf(userSeq));
        return expiresAt != null && expiresAt > System.currentTimeMillis();
    }

    /** ticketingDate 가 타임존 없는 LocalDateTime 이라 여기서도 서버 로컬 기준으로 맞춘다. */
    private static LocalDateTime toLocalDateTime(long epochMillis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault());
    }
}
