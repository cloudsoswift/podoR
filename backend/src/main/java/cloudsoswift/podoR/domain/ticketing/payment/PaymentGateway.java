package cloudsoswift.podoR.domain.ticketing.payment;

/** 결제 대행사(PG) 호출 추상화. 운영은 토스페이먼츠, 기본/테스트는 mock. */
public interface PaymentGateway {

    /** 결제 승인. 실패 시 {@link PaymentGatewayException}. */
    ConfirmResult confirm(String paymentKey, String orderId, long amount);

    /** 결제 취소(부분/전액). idempotencyKey 로 중복 취소를 막는다. 실패 시 {@link PaymentGatewayException}. */
    void cancel(String paymentKey, long cancelAmount, String reason, String idempotencyKey);
}
