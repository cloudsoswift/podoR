package cloudsoswift.podoR.domain.stream.media;

import cloudsoswift.podoR.domain.stream.StreamProperties;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MediaCookieSignerTest {

    private static MediaCookieSigner signer(String secret) {
        return new MediaCookieSigner(new StreamProperties("rtmp://h/live", 1, Duration.ofMinutes(3), "t", secret, "/media"));
    }

    final Instant now = Instant.parse("2026-11-02T11:00:00Z");

    @Test
    void 서명한_토큰은_검증된다() {
        MediaCookieSigner s = signer("secret-a");
        String token = s.sign(5L, "E-1", now.plusSeconds(600));

        assertThat(s.verify(token, now)).contains(new MediaClaims(5L, "E-1", now.plusSeconds(600)));
    }

    @Test
    void 만료되면_빈값() {
        MediaCookieSigner s = signer("secret-a");
        String token = s.sign(5L, "E-1", now.plusSeconds(600));

        assertThat(s.verify(token, now.plusSeconds(601))).isEmpty();
    }

    @Test
    void 한_글자만_바꿔도_빈값() {
        MediaCookieSigner s = signer("secret-a");
        String token = s.sign(5L, "E-1", now.plusSeconds(600));
        char last = token.charAt(token.length() - 1);
        String tampered = token.substring(0, token.length() - 1) + (last == 'A' ? 'B' : 'A');

        assertThat(s.verify(tampered, now)).isEmpty();
        assertThat(s.verify("garbage", now)).isEmpty();
        assertThat(s.verify(null, now)).isEmpty();
    }

    @Test
    void 다른_비밀키로_서명하면_빈값() {
        String token = signer("secret-a").sign(5L, "E-1", now.plusSeconds(600));

        assertThat(signer("secret-b").verify(token, now)).isEmpty();
    }

    @Test
    void 비밀키가_비어_있으면_서명도_검증도_하지_않는다() {
        String token = signer("secret-a").sign(5L, "E-1", now.plusSeconds(600));
        MediaCookieSigner blank = signer("");

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> blank.sign(5L, "E-1", now.plusSeconds(600)))
                .isInstanceOf(IllegalStateException.class);
        assertThat(blank.verify(token, now)).isEmpty();
    }
}
