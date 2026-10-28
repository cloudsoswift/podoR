package cloudsoswift.podoR.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

import java.util.HashMap;
import java.util.Map;

/**
 * OAuth2 인가 요청을 두 가지로 보강한다.
 * 1) 소셜 로그인 세션을 재사용하지 않고 매번 계정 선택/로그인 화면을 띄운다
 *    (Google=prompt=select_account, Kakao=prompt=login).
 * 2) ?redirect= 로 받은 복귀 경로를 세션에 보관한다. 카카오를 거치는 동안에는 쿼리가 살아남지 않으므로,
 *    Spring 이 인가 요청(state)을 보관하는 것과 같은 HttpSession 에 함께 둔다.
 *    성공/실패 핸들러가 RedirectPaths.consume 으로 꺼낸다.
 */
public class PromptAndRedirectAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public PromptAndRedirectAuthorizationRequestResolver(ClientRegistrationRepository repo) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(repo, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return customize(request, delegate.resolve(request, clientRegistrationId));
    }

    private static OAuth2AuthorizationRequest customize(HttpServletRequest request, OAuth2AuthorizationRequest req) {
        // 이 resolver 는 모든 요청마다 호출된다. null = 로그인 시작 요청이 아님 → 세션을 절대 건드리지 않는다.
        if (req == null) return null;
        rememberRedirect(request);
        return withPrompt(req);
    }

    private static void rememberRedirect(HttpServletRequest request) {
        String redirect = RedirectPaths.sanitize(request.getParameter(RedirectPaths.PARAMETER));
        if (redirect != null) {
            request.getSession().setAttribute(RedirectPaths.SESSION_ATTRIBUTE, redirect);
            return;
        }
        // 값 없이 다시 로그인하면 이전 목적지가 딸려 오지 않도록 지운다.
        HttpSession session = request.getSession(false);
        if (session != null) session.removeAttribute(RedirectPaths.SESSION_ATTRIBUTE);
    }

    private static OAuth2AuthorizationRequest withPrompt(OAuth2AuthorizationRequest req) {
        String registrationId = (String) req.getAttributes().get(OAuth2ParameterNames.REGISTRATION_ID);
        Map<String, Object> extra = new HashMap<>(req.getAdditionalParameters());
        extra.put("prompt", "kakao".equals(registrationId) ? "login" : "select_account");
        return OAuth2AuthorizationRequest.from(req).additionalParameters(extra).build();
    }
}
