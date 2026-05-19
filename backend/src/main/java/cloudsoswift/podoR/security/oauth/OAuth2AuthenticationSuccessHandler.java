package cloudsoswift.podoR.security.oauth;

import cloudsoswift.podoR.security.jwt.JwtTokenProvider;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler
        extends SimpleUrlAuthenticationSuccessHandler {
    // Spring Security가 OAuth2 인증을 완료하면 호출되는 핸들러
    private final JwtTokenProvider jwtTokenProvider;
    @Value("${app.oauth2.authorizedRedirectUri}")
    private String frontendURL;
    @Value("${jwt.refresh-token-expiration}")
    private long REFRESH_TOKEN_EXPIRE_MS;

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        // CustomOAuth2User에서 유저 정보 꺼냄
        CustomOAuth2User oAuth2User =
                (CustomOAuth2User) authentication.getPrincipal();

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider
                .generateAccessToken(authentication);
        String refreshToken = jwtTokenProvider
                .generateRefreshToken(oAuth2User.getUser().getSeq());

        // Refresh Token은 httpOnly Cookie로 설정
        ResponseCookie cookie = ResponseCookie.from("refresh_token", refreshToken)
                .httpOnly(true)          // JS 접근 차단 → XSS 방어
                .secure(true)            // HTTPS only
                .sameSite("Strict")      // 타 사이트에서 쿠키 전송 차단 → CSRF 방어
                .path("/oauth2/token/refresh")   // refresh 엔드포인트에만 전송
                .maxAge(Duration.ofMillis(REFRESH_TOKEN_EXPIRE_MS))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // 프론트엔드로 리다이렉트 (토큰 전달)
        String targetUrl = UriComponentsBuilder
                .fromUriString(frontendURL + "/oauth2/redirect")
                .queryParam("accessToken", accessToken)
                .build()
                .toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}