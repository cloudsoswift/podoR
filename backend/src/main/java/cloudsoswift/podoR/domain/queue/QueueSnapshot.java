package cloudsoswift.podoR.domain.queue;

import java.time.LocalDateTime;

/**
 * Redis 계층(WaitingQueueService)이 돌려주는 결과.
 * NOT_OPEN 은 여기서 나오지 않는다 — 오픈 시각 판단은 상위(TicketingQueueService) 몫이다.
 *
 * @param ahead          WAITING 일 때 내 앞에 있는 인원(0-based rank). ADMITTED 면 0.
 * @param passExpiresAt  ADMITTED 일 때 입장권 만료 시각. WAITING 이면 null.
 */
public record QueueSnapshot(QueueStatus status, long ahead, LocalDateTime passExpiresAt) {
}
