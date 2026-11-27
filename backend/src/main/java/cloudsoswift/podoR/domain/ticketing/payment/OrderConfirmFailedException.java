package cloudsoswift.podoR.domain.ticketing.payment;

import org.springframework.http.HttpStatus;

/**
 * 확정 검증 실패(금액 불일치, 선점 만료, 좌석 판매됨). 주문은 FAILED 로 기록되고,
 * code 는 결제 실패 사유(fail_code)로, message 는 사용자에게 보여줄 문구(ProblemDetail detail)로 쓴다.
 */
public class OrderConfirmFailedException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public OrderConfirmFailedException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
