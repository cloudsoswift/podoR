package cloudsoswift.podoR.domain.stream.policy;

import cloudsoswift.podoR.domain.event.entity.Event;

import java.time.LocalDateTime;

/**
 * 이 회차가 지금 송출을 시작해도 되는지. 송출 가능 시간 규칙을 한 곳에 모으는 자리다
 * (지금은 공연 시간 필드가 없어 제한하지 않는다).
 */
public interface StreamPublishPolicy {
    boolean allows(Event event, LocalDateTime now);
}
