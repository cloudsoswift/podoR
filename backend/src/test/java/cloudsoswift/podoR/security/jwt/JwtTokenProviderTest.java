package cloudsoswift.podoR.security.jwt;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 순수 단위 테스트. 생성자가 secret 을 파라미터로 받으므로 Spring 없이 생성 가능하나,
 * 만료 시간 두 개는 @Value 필드 주입이라 직접 넣지 않으면 0 이 되어 토큰이 즉시 만료된다.
 */
class JwtTokenProviderTest {

    // test application.yml 과 동일한 Base64 시크릿(256bit 이상)
    private static final String SECRET = "YWQwYXNkaSFrbG1BQ0xBTWMhTG5BTENBWENNWENNQVNDQVNES0FTRF8h";

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(SECRET);
        ReflectionTestUtils.setField(provider, "ACCESS_TOKEN_EXPIRE_MS", 60_000L);
        ReflectionTestUtils.setField(provider, "REFRESH_TOKEN_EXPIRE_MS", 600_000L);
    }

    @Test
    void 발급한_AT는_검증을_통과하고_seq와_role을_담는다() {
        String token = provider.generateAccessToken(100L, "ADMIN");

        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getUserSeq(token)).isEqualTo(100L);

        Authentication auth = provider.getAuthentication(token);
        assertThat(auth.getPrincipal()).isEqualTo(100L); // principal 은 Long(userSeq)
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
    }

    @Test
    void 발급한_RT는_검증을_통과하고_seq를_담는다() {
        String refreshToken = provider.generateRefreshToken(7L);

        assertThat(provider.validateToken(refreshToken)).isTrue();
        assertThat(provider.getUserSeq(refreshToken)).isEqualTo(7L);
    }

    @Test
    void 서명이_변조된_토큰은_거부된다() {
        String token = provider.generateAccessToken(100L, "USER");
        String tampered = token + "x"; // 서명 부분 훼손

        assertThat(provider.validateToken(tampered)).isFalse();
    }

    @Test
    void 형식이_아닌_문자열은_거부된다() {
        assertThat(provider.validateToken("not-a-jwt")).isFalse();
    }

    @Test
    void 만료된_토큰은_거부된다() {
        ReflectionTestUtils.setField(provider, "ACCESS_TOKEN_EXPIRE_MS", -1_000L);
        String expired = provider.generateAccessToken(100L, "USER");

        assertThat(provider.validateToken(expired)).isFalse();
    }
}
