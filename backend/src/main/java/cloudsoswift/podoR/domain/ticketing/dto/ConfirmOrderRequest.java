package cloudsoswift.podoR.domain.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 결제 확정 요청: 토스 successUrl 로 받은 paymentKey 와 금액. 금액은 서버 주문 금액과 대조만 한다. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConfirmOrderRequest {
    private String paymentKey;
    private Long amount;
}
