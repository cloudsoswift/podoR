package cloudsoswift.podoR.domain.queue;

import cloudsoswift.podoR.domain.event.cache.EventTicketingDateCache;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.queue.dto.QueueStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * 대기열의 정책 계층. Redis 기계장치는 WaitingQueueService 가 맡는다.
 *
 * 오픈 시각(ticketingDate) 판단을 Lua 이전에 Java 에서 하는 이유:
 * 오픈 전에는 순번조차 발급하지 않아야 하고, 그러려면 Redis 를 아예 건드리지 않는 게 가장 확실하다.
 */
@Service
@RequiredArgsConstructor
public class TicketingQueueService {
    // 클래스 레벨 트랜잭션을 달아두었으나 제거.
    // 캐싱 가능한 단건 조회 및 Redis 호출을 수행하는 동안 DB 커넥션을 쥐는 자원 낭비를 방지하기 위함.

    private final EventRepository eventRepository;
    private final WaitingQueueService waitingQueue;
    private final EventTicketingDateCache ticketingDateCache;

    /** 등록 + 하트비트 + 승격 시도 + 상태 조회(멱등). 대기 화면의 폴링 대상. */
    public QueueStatusResponse enterOrPoll(String eventId, long userSeq) {
        // Redis 캐시로부터 이벤트의 티켓팅 시간을 조회.
        // 캐시가 비었거나 Redis에 문제가 있으면 DB로 폴백.
        LocalDateTime opensAt = ticketingDateCache.get(eventId).orElseGet(() -> {
            LocalDateTime fromDb = findEvent(eventId).getTicketingDate();
            ticketingDateCache.put(eventId, fromDb);
            return fromDb;
        });
        if (LocalDateTime.now().isBefore(opensAt)) {
            return new QueueStatusResponse(QueueStatus.NOT_OPEN, null, null, null, opensAt);
        }

        QueueSnapshot snapshot = waitingQueue.enterOrPoll(eventId, userSeq);
        if (snapshot.status() == QueueStatus.ADMITTED) {
            return new QueueStatusResponse(
                    QueueStatus.ADMITTED, null, null, snapshot.passExpiresAt(), opensAt);
        }
        return new QueueStatusResponse(
                QueueStatus.WAITING, snapshot.ahead() + 1, snapshot.ahead(), null, opensAt);
    }

    /** 이탈 — 대기 취소 또는 입장권 반납. */
    public void leave(String eventId, long userSeq) {
        findEvent(eventId); // 없는 이벤트면 404
        waitingQueue.leave(eventId, userSeq);
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }
}
