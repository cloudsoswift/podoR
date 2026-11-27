package cloudsoswift.podoR.domain.ticketing.payment;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** 항상 승인/취소에 성공하는 가짜 PG. 테스트 훅(failNext, onNextConfirm)과 호출 기록을 제공한다. */
@Component
@ConditionalOnProperty(name = "payment.gateway", havingValue = "mock", matchIfMissing = true)
public class MockPaymentGateway implements PaymentGateway {

    public record ConfirmCall(String paymentKey, String orderId, long amount) {
    }

    public record CancelCall(String paymentKey, long cancelAmount, String reason, String idempotencyKey) {
    }

    private final Object lock = new Object();
    private final List<ConfirmCall> confirmCalls = new ArrayList<>();
    private final List<CancelCall> cancelCalls = new ArrayList<>();
    private String failCode;
    private String failMessage;
    private Runnable afterConfirm;

    @Override
    public ConfirmResult confirm(String paymentKey, String orderId, long amount) {
        Runnable hook;
        synchronized (lock) {
            confirmCalls.add(new ConfirmCall(paymentKey, orderId, amount));
            throwIfFailArmed();
            hook = afterConfirm;
            afterConfirm = null;
        }
        if (hook != null) {
            hook.run();
        }
        return new ConfirmResult("MOCK");
    }

    @Override
    public void cancel(String paymentKey, long cancelAmount, String reason, String idempotencyKey) {
        synchronized (lock) {
            cancelCalls.add(new CancelCall(paymentKey, cancelAmount, reason, idempotencyKey));
            throwIfFailArmed();
        }
    }

    /** 다음 호출(승인 또는 취소) 1회를 주어진 코드/메시지로 실패시킨다. */
    public void failNext(String code, String message) {
        synchronized (lock) {
            failCode = code;
            failMessage = message;
        }
    }

    /** 다음 승인 직후 1회 실행할 동작을 등록한다(동시성 시나리오 재현용). */
    public void onNextConfirm(Runnable action) {
        synchronized (lock) {
            afterConfirm = action;
        }
    }

    public List<ConfirmCall> confirmCalls() {
        synchronized (lock) {
            return List.copyOf(confirmCalls);
        }
    }

    public List<CancelCall> cancelCalls() {
        synchronized (lock) {
            return List.copyOf(cancelCalls);
        }
    }

    /** 테스트 격리용: 훅과 기록을 모두 비운다. */
    public void reset() {
        synchronized (lock) {
            confirmCalls.clear();
            cancelCalls.clear();
            failCode = null;
            failMessage = null;
            afterConfirm = null;
        }
    }

    private void throwIfFailArmed() {
        if (failCode != null) {
            String code = failCode;
            String message = failMessage;
            failCode = null;
            failMessage = null;
            throw new PaymentGatewayException(code, message);
        }
    }
}
