package cloudsoswift.podoR.domain.ticketing.payment;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MockPaymentGatewayTest {

    private final MockPaymentGateway gateway = new MockPaymentGateway();

    @Test
    void confirm_은_MOCK_을_돌려주고_호출을_기록한다() {
        ConfirmResult r = gateway.confirm("pk", "o1", 100);
        assertThat(r.method()).isEqualTo("MOCK");
        assertThat(gateway.confirmCalls()).hasSize(1);
    }

    @Test
    void failNext_는_다음_한_번만_실패한다() {
        gateway.failNext("X", "boom");
        assertThatThrownBy(() -> gateway.confirm("pk", "o1", 100))
                .isInstanceOfSatisfying(PaymentGatewayException.class, e -> {
                    assertThat(e.code()).isEqualTo("X");
                    assertThat(e.getMessage()).isEqualTo("boom");
                });
        assertThat(gateway.confirm("pk", "o1", 100).method()).isEqualTo("MOCK");
    }

    @Test
    void onNextConfirm_은_승인_직후_한_번만_실행된다() {
        AtomicInteger n = new AtomicInteger();
        gateway.onNextConfirm(n::incrementAndGet);
        gateway.confirm("pk", "o1", 100);
        gateway.confirm("pk", "o1", 100);
        assertThat(n.get()).isEqualTo(1);
    }

    @Test
    void cancel_은_기록하고_reset_은_초기화한다() {
        gateway.cancel("pk", 10, "r", "k");
        assertThat(gateway.cancelCalls()).hasSize(1);
        gateway.failNext("X", "m");
        gateway.reset();
        gateway.confirm("pk", "o", 1);
        assertThat(gateway.cancelCalls()).isEmpty();
        assertThat(gateway.confirmCalls()).hasSize(1);
    }
}
