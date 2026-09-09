package cloudsoswift.podoR.security.oauth;

import cloudsoswift.podoR.domain.user.entity.Role;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.security.jwt.JwtTokenProvider;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuth2AuthenticationSuccessHandlerTest {

    @Mock JwtTokenProvider jwtTokenProvider;

    @InjectMocks OAuth2AuthenticationSuccessHandler handler;

    private Authentication authentication;

    @BeforeEach
    void setUp() {
        // @Value 필드 주입분은 단위 테스트에서 직접 넣어야 한다
        ReflectionTestUtils.setField(handler, "frontendURL", "https://front.example");
        ReflectionTestUtils.setField(handler, "REFRESH_TOKEN_EXPIRE_MS", 604_800_000L);

        User user = User.builder()
                .email("a@b.c").nickname("nick")
                .provider("KAKAO").providerId("p1").role(Role.USER)
                .build();
        ReflectionTestUtils.setField(user, "seq", 42L); // @GeneratedValue 라 세터가 없다
        CustomOAuth2User principal = new CustomOAuth2User(user, Map.of());
        authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
    }

    @Test
    void 리프레시_토큰을_보안속성을_갖춘_쿠키로_내려준다() throws Exception {
        when(jwtTokenProvider.generateAccessToken(authentication)).thenReturn("AT");
        when(jwtTokenProvider.generateRefreshToken(42L)).thenReturn("RT");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, authentication);

        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie)
                .contains("refresh_token=RT")
                .contains("HttpOnly")                          // XSS 방어
                .contains("Secure")                            // HTTPS 전용
                .contains("SameSite=Strict")                   // CSRF 방어
                .contains("Path=/api/oauth2/token/refresh");   // 재발급 엔드포인트에만 전송
    }

    @Test
    void 액세스_토큰을_쿼리에_담아_프론트로_리다이렉트한다() throws Exception {
        when(jwtTokenProvider.generateAccessToken(authentication)).thenReturn("AT");
        when(jwtTokenProvider.generateRefreshToken(42L)).thenReturn("RT");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, authentication);

        assertThat(response.getRedirectedUrl())
                .isEqualTo("https://front.example/oauth2/redirect?accessToken=AT");
    }
}
