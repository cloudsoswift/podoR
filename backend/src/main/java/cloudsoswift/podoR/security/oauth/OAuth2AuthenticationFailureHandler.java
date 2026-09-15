package cloudsoswift.podoR.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
public class OAuth2AuthenticationFailureHandler
        extends SimpleUrlAuthenticationFailureHandler {
// OAuth2 로그인 실패시 호출되는 핸들러

    // 리다이렉트 대상은 브라우저가 해석하므로 서버 로컬 주소를 박아두면 안 된다.
    // 성공 핸들러와 동일한 프로퍼티를 써서 환경(local/deploy)에 맞는 프론트 주소로 보낸다.
    @Value("${app.oauth2.authorizedRedirectUri}")
    private String frontendURL;

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException {

        UriComponentsBuilder target = UriComponentsBuilder
                .fromUriString(frontendURL + "/login")
                .queryParam("error", exception.getLocalizedMessage());
        // 다시 로그인해도 원래 목적지로 돌아가도록 유지한다.
        String redirect = RedirectPaths.consume(request);
        if (redirect != null) {
            target.queryParam(RedirectPaths.PARAMETER, redirect);
        }
        // error 에 공백·한글이 들어갈 수 있으므로 인코딩한다.
        String targetUrl = target.build().encode().toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}