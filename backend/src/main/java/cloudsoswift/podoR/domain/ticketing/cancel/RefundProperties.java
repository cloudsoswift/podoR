package cloudsoswift.podoR.domain.ticketing.cancel;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * 환불 정책 설정.
 *
 * @param userCancelCutoff 공연 시작 이 시간 전부터 관객 취소를 막는다(공연장 배치 변경 취소는 예외)
 */
@ConfigurationProperties("refund")
public record RefundProperties(@DefaultValue("30m") Duration userCancelCutoff) {
}
