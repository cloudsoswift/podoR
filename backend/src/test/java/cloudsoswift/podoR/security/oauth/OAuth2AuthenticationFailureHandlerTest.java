package cloudsoswift.podoR.security.oauth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class OAuth2AuthenticationFailureHandlerTest {

    /**
     * 리다이렉트는 브라우저가 해석하므로 서버 로컬 주소를 박아두면 배포 환경에서 깨진다.
     * 주입된 프런트 주소를 써야 한다.
     */
    @Test
    void 주입된_프론트_주소의_login_으로_실패사유와_함께_리다이렉트한다() throws Exception {
        OAuth2AuthenticationFailureHandler handler = new OAuth2AuthenticationFailureHandler();
        ReflectionTestUtils.setField(handler, "frontendURL", "https://front.example");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(
                new MockHttpServletRequest(), response, new BadCredentialsException("bad-credential"));

        assertThat(response.getRedirectedUrl())
                .startsWith("https://front.example/login?error=")
                .contains("bad-credential");
    }
}
