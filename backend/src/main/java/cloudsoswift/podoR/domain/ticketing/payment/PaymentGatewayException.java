package cloudsoswift.podoR.domain.ticketing.payment;

/** PG 호출 실패. message 는 PG 가 준 메시지, code 는 PG 에러 코드. */
public class PaymentGatewayException extends RuntimeException {

    private final String code;

    public PaymentGatewayException(String code, String message) {
        super(message);
        this.code = code;
    }

    public PaymentGatewayException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
