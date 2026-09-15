package cloudsoswift.podoR.security.oauth;

import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;

class PromptAndRedirectAuthorizationRequestResolverTest {

    private final PromptAndRedirectAuthorizationRequestResolver resolver =
            new PromptAndRedirectAuthorizationRequestResolver(new InMemoryClientRegistrationRepository(
                    ClientRegistration.withRegistrationId("kakao")
                            .clientId("client-id")
                            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                            .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                            .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                            .tokenUri("https://kauth.kakao.com/oauth/token")
                            .build()));

    /** 경로 매처가 requestURI 기준이든 servletPath 기준이든 맞도록 둘 다 채운다. */
    private static MockHttpServletRequest get(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setServletPath(path);
        return request;
    }

    private static Object storedRedirect(MockHttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : session.getAttribute(RedirectPaths.SESSION_ATTRIBUTE);
    }

    @Test
    void 로그인_시작_요청이면_안전한_redirect_를_세션에_저장하고_prompt_를_유지한다() {
        MockHttpServletRequest request = get("/oauth2/authorization/kakao");
        request.setParameter("redirect", "/events/E1/seats");

        OAuth2AuthorizationRequest result = resolver.resolve(request);

        // null 이면 매처가 요청을 로그인 시작으로 인식하지 못한 것 — 테스트 요청 구성을 먼저 의심할 것
        assertThat(result).isNotNull();
        assertThat(result.getAdditionalParameters()).containsEntry("prompt", "login");
        assertThat(storedRedirect(request)).isEqualTo("/events/E1/seats");
    }

    @Test
    void 로그인_시작이_아닌_요청은_null_이고_세션을_만들지_않는다() {
        // resolver 는 모든 요청마다 호출된다. 여기서 세션을 만들면 일반 API 요청마다 세션이 생긴다.
        MockHttpServletRequest request = get("/events/E1/seat-view");
        request.setParameter("redirect", "/events/E1/seats");

        assertThat(resolver.resolve(request)).isNull();
        assertThat(request.getSession(false)).isNull();
    }

    @Test
    void 안전하지_않은_redirect_는_저장하지_않는다() {
        MockHttpServletRequest request = get("/oauth2/authorization/kakao");
        request.setParameter("redirect", "//evil.com");

        assertThat(resolver.resolve(request)).isNotNull();
        assertThat(storedRedirect(request)).isNull();
    }

    @Test
    void redirect_없이_다시_로그인하면_이전_값을_지운다() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(RedirectPaths.SESSION_ATTRIBUTE, "/old");
        MockHttpServletRequest request = get("/oauth2/authorization/kakao");
        request.setSession(session);

        resolver.resolve(request);

        assertThat(session.getAttribute(RedirectPaths.SESSION_ATTRIBUTE)).isNull();
    }
}
