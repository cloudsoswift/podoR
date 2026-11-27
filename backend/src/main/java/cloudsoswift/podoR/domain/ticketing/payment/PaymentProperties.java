package cloudsoswift.podoR.domain.ticketing.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * 결제 설정.
 *
 * @param gateway    {@code mock}(기본) 또는 {@code toss}
 * @param pendingTtl 결제 대기(PENDING) 주문을 유지하는 시간
 */
@ConfigurationProperties("payment")
public record PaymentProperties(
        @DefaultValue("mock") String gateway,
        @DefaultValue("15m") Duration pendingTtl,
        @DefaultValue Toss toss) {

    public record Toss(
            String secretKey,
            @DefaultValue("https://api.tosspayments.com") String baseUrl,
            @DefaultValue("5s") Duration timeout) {
    }
}
