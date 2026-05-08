package cloudsoswift.podoR.security.oauth;

import cloudsoswift.podoR.security.jwt.JwtTokenProvider;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler
        extends SimpleUrlAuthenticationSuccessHandler {
// Spring Security가 OAuth2 인증을 완료하면 호출되는 핸들러
    private final JwtTokenProvider jwtTokenProvider;

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

        // 프론트엔드로 리다이렉트 (토큰 전달)
        String targetUrl = UriComponentsBuilder
                .fromUriString("http://localhost:3000/oauth2/redirect")
                .queryParam("accessToken", accessToken)
                .queryParam("refreshToken", refreshToken)
                .build()
                .toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}