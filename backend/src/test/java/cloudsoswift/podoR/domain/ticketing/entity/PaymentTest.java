package cloudsoswift.podoR.domain.ticketing.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentTest {

    @Test
    void ready_는_READY_이고_paidAt_없음() {
        Payment p = Payment.ready(null, 30000L);
        assertThat(p.getStatus()).isEqualTo("READY");
        assertThat(p.getAmount()).isEqualTo(30000L);
        assertThat(p.getCancelledAmount()).isZero();
        assertThat(p.getPaidAt()).isNull();
    }

    @Test
    void complete_는_paymentKey_와_paidAt() {
        Payment p = Payment.ready(null, 30000L);
        LocalDateTime at = LocalDateTime.of(2026, 11, 27, 10, 0);
        p.complete("pk_1", "카드", at);
        assertThat(p.getStatus()).isEqualTo("COMPLETED");
        assertThat(p.getPaymentKey()).isEqualTo("pk_1");
        assertThat(p.getMethod()).isEqualTo("카드");
        assertThat(p.getPaidAt()).isEqualTo(at);
    }

    @Test
    void fail_은_코드와_메시지를_남긴다() {
        Payment p = Payment.ready(null, 30000L);
        p.fail("REJECT_CARD", "카드 거절");
        assertThat(p.getStatus()).isEqualTo("FAILED");
        assertThat(p.getFailCode()).isEqualTo("REJECT_CARD");
        assertThat(p.getFailMessage()).isEqualTo("카드 거절");
        assertThat(p.getPaidAt()).isNull();
    }
}
