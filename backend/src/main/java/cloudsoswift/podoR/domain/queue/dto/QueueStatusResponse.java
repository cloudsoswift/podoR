package cloudsoswift.podoR.domain.queue.dto;

import cloudsoswift.podoR.domain.queue.QueueStatus;

import java.time.LocalDateTime;

/**
 * POST /events/{eventId}/queue 응답.
 * 상태에 따라 유효한 필드가 다르다(무관한 필드는 null).
 *
 * @param position       WAITING: 1부터 시작하는 내 순번
 * @param ahead          WAITING: 내 앞 인원
 * @param passExpiresAt  ADMITTED: 입장권 만료 시각
 * @param opensAt        항상 유효 — FE 가 NOT_OPEN 일 때 카운트다운에 쓴다
 */
public record QueueStatusResponse(
        QueueStatus status,
        Long position,
        Long ahead,
        LocalDateTime passExpiresAt,
        LocalDateTime opensAt) {
}
