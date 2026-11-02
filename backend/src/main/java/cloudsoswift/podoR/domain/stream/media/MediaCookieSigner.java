package cloudsoswift.podoR.domain.stream.media;

import cloudsoswift.podoR.domain.stream.StreamProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * 미디어 쿠키 토큰 = base64url("userSeq:eventId:expEpochSec") + "." + base64url(HMAC-SHA256).
 *
 * nginx auth_request 가 HLS 조각마다 묻기 때문에 DB 를 보지 않고 서명·만료만으로 판정한다.
 * 비밀키가 비어 있으면 서명하지 않고(예외) 어떤 토큰도 통과시키지 않는다.
 */
@Component
public class MediaCookieSigner {

    private static final String ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final String secret;

    public MediaCookieSigner(StreamProperties props) {
        this.secret = props.mediaCookieSecret();
    }

    public String sign(Long userSeq, String eventId, Instant exp) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("stream.media-cookie-secret is not configured");
        }
        String payload = ENCODER.encodeToString(
                (userSeq + ":" + eventId + ":" + exp.getEpochSecond()).getBytes(StandardCharsets.UTF_8));
        return payload + "." + ENCODER.encodeToString(hmac(payload));
    }

    public Optional<MediaClaims> verify(String token, Instant now) {
        if (secret == null || secret.isBlank() || token == null) {
            return Optional.empty();
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot != token.lastIndexOf('.')) {
            return Optional.empty();
        }
        String payload = token.substring(0, dot);
        try {
            byte[] given = DECODER.decode(token.substring(dot + 1));
            if (!MessageDigest.isEqual(hmac(payload), given)) {
                return Optional.empty();
            }
            String plain = new String(DECODER.decode(payload), StandardCharsets.UTF_8);
            int first = plain.indexOf(':');
            int last = plain.lastIndexOf(':');
            if (first <= 0 || last <= first) {
                return Optional.empty();
            }
            Instant exp = Instant.ofEpochSecond(Long.parseLong(plain.substring(last + 1)));
            if (now.isAfter(exp)) {
                return Optional.empty();
            }
            return Optional.of(new MediaClaims(Long.parseLong(plain.substring(0, first)),
                    plain.substring(first + 1, last), exp));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private byte[] hmac(String payload) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
