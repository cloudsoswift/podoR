package cloudsoswift.podoR.domain.ticketing.cancel;

/** 환불 정책이 취소를 거절했다. 메시지는 사용자에게 그대로 보인다(400). */
public class CancellationNotAllowedException extends RuntimeException {

    public CancellationNotAllowedException(String message) {
        super(message);
    }
}
