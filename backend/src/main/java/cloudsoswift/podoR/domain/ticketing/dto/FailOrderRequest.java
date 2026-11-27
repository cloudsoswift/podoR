package cloudsoswift.podoR.domain.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 결제 실패 기록 요청: 토스 failUrl 로 받은 에러 코드와 메시지. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FailOrderRequest {
    private String code;
    private String message;
}
