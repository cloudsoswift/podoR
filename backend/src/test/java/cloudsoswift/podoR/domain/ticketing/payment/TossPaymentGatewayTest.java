package cloudsoswift.podoR.domain.ticketing.payment;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TossPaymentGatewayTest {

    private static final String BASE = "https://api.test.local";

    private MockRestServiceServer server;
    private TossPaymentGateway gateway;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        PaymentProperties props = new PaymentProperties("toss", Duration.ofMinutes(15),
                new PaymentProperties.Toss("test_gsk_x", BASE, Duration.ofSeconds(5)));
        gateway = new TossPaymentGateway(props, builder);
    }

    @Test
    void confirm_은_Basic_인증과_바디를_보낸다() {
        String auth = "Basic " + Base64.getEncoder().encodeToString("test_gsk_x:".getBytes(StandardCharsets.UTF_8));
        server.expect(requestTo(BASE + "/v1/payments/confirm"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", auth))
                .andExpect(content().json("{\"paymentKey\":\"pk\",\"orderId\":\"20261127-ABCDEF12\",\"amount\":30000}", true))
                .andRespond(withSuccess("{\"method\":\"카드\"}", MediaType.APPLICATION_JSON));

        ConfirmResult result = gateway.confirm("pk", "20261127-ABCDEF12", 30000);

        assertThat(result).isEqualTo(new ConfirmResult("카드"));
        server.verify();
    }

    @Test
    void cancel_은_멱등키와_금액을_보낸다() {
        server.expect(requestTo(BASE + "/v1/payments/pk/cancel"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Idempotency-Key", "k1"))
                .andExpect(content().json("{\"cancelReason\":\"관객 취소\",\"cancelAmount\":10000}", true))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        gateway.cancel("pk", 10000, "관객 취소", "k1");

        server.verify();
    }

    @Test
    void 토스_에러는_코드와_메시지로() {
        server.expect(requestTo(BASE + "/v1/payments/confirm"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"code\":\"REJECT_CARD_PAYMENT\",\"message\":\"한도초과\"}"));

        assertThatThrownBy(() -> gateway.confirm("pk", "o", 1))
                .isInstanceOfSatisfying(PaymentGatewayException.class, e -> {
                    assertThat(e.code()).isEqualTo("REJECT_CARD_PAYMENT");
                    assertThat(e.getMessage()).isEqualTo("한도초과");
                });
    }

    @Test
    void secretKey_가_비면_시작_실패() {
        PaymentProperties props = new PaymentProperties("toss", Duration.ofMinutes(15),
                new PaymentProperties.Toss("", BASE, Duration.ofSeconds(5)));
        assertThatThrownBy(() -> new TossPaymentGateway(props, RestClient.builder()))
                .isInstanceOf(IllegalStateException.class);
    }
}
