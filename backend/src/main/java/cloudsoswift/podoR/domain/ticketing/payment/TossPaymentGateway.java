package cloudsoswift.podoR.domain.ticketing.payment;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/** 토스페이먼츠 결제 승인/취소 API 클라이언트. */
@Component
@ConditionalOnProperty(name = "payment.gateway", havingValue = "toss")
public class TossPaymentGateway implements PaymentGateway {

    private final RestClient client;

    /** Spring 이 사용하는 생성자. 빌더 빈이 없으면 새 빌더로 대체하고 타임아웃을 요청 팩토리에 적용한다. */
    @Autowired
    public TossPaymentGateway(PaymentProperties properties, ObjectProvider<RestClient.Builder> builderProvider) {
        this(properties, builderProvider.getIfAvailable(RestClient::builder).clone(), true);
    }

    /** 주어진 빌더를 그대로 사용(테스트에서 MockRestServiceServer 바인딩용 — 요청 팩토리를 덮어쓰지 않는다). */
    public TossPaymentGateway(PaymentProperties properties, RestClient.Builder builder) {
        this(properties, builder, false);
    }

    private TossPaymentGateway(PaymentProperties properties, RestClient.Builder builder, boolean applyTimeout) {
        PaymentProperties.Toss toss = properties.toss();
        if (toss.secretKey() == null || toss.secretKey().isBlank()) {
            throw new IllegalStateException("payment.toss.secret-key 가 설정되지 않았습니다.");
        }
        if (applyTimeout) {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(toss.timeout());
            factory.setReadTimeout(toss.timeout());
            builder.requestFactory(factory);
        }
        String basic = Base64.getEncoder().encodeToString((toss.secretKey() + ":").getBytes(StandardCharsets.UTF_8));
        this.client = builder
                .baseUrl(toss.baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .build();
    }

    @Override
    public ConfirmResult confirm(String paymentKey, String orderId, long amount) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("paymentKey", paymentKey);
        body.put("orderId", orderId);
        body.put("amount", amount);
        Map<?, ?> res = call(() -> client.post().uri("/v1/payments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class));
        Object method = res == null ? null : res.get("method");
        return new ConfirmResult(method == null ? null : method.toString());
    }

    @Override
    public void cancel(String paymentKey, long cancelAmount, String reason, String idempotencyKey) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("cancelReason", reason);
        body.put("cancelAmount", cancelAmount);
        call(() -> client.post().uri("/v1/payments/{paymentKey}/cancel", paymentKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class));
    }

    private <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException e) {
            throw toException(e);
        } catch (RestClientException e) {
            throw new PaymentGatewayException("GATEWAY_UNAVAILABLE", "결제 대행사 통신에 실패했습니다.", e);
        }
    }

    private PaymentGatewayException toException(RestClientResponseException e) {
        String code = "UNKNOWN";
        String message = e.getMessage();
        try {
            Map<?, ?> err = e.getResponseBodyAs(Map.class);
            if (err != null) {
                if (err.get("code") != null) {
                    code = err.get("code").toString();
                }
                if (err.get("message") != null) {
                    message = err.get("message").toString();
                }
            }
        } catch (RuntimeException ignored) {
            // 본문이 JSON 이 아니면 기본값 사용
        }
        return new PaymentGatewayException(code, message, e);
    }
}
