package cloudsoswift.podoR.security.oauth;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.user.entity.Role;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.service.UserService;
import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import cloudsoswift.podoR.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 토큰 재발급의 보안 규칙 회귀 가드.
 * 탈퇴한 사용자가 RT 로 계속 새 AT 를 받아가던 결함을 막기 위한 테스트다.
 * (@WebMvcTest 레시피의 배경은 EventTicketingControllerTest 및 웹 계층 슬라이스 참고)
 */
@WebMvcTest(value = TokenController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class TokenControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean JwtTokenProvider jwtTokenProvider;
    @MockitoBean UserService userService;

    private static Cookie refreshCookie(String value) {
        return new Cookie("refresh_token", value);
    }

    private static User activeUser() {
        User user = User.builder()
                .email("a@b.c").nickname("nick")
                .provider("KAKAO").providerId("p1").role(Role.USER)
                .build();
        ReflectionTestUtils.setField(user, "seq", 42L);
        return user;
    }

    @Test
    void 쿠키에_RT가_없으면_401() throws Exception {
        mvc.perform(post("/oauth2/token/refresh"))
                .andExpect(status().isUnauthorized());
        verify(jwtTokenProvider, never()).getUserSeq(anyString());
    }

    @Test
    void 유효하지_않은_RT면_401() throws Exception {
        when(jwtTokenProvider.validateToken("bad")).thenReturn(false);

        mvc.perform(post("/oauth2/token/refresh").cookie(refreshCookie("bad")))
                .andExpect(status().isUnauthorized());
        verify(userService, never()).findActiveBySeq(anyLong());
    }

    @Test
    void 탈퇴했거나_존재하지_않는_사용자면_401_그리고_새_토큰을_발급하지_않는다() throws Exception {
        when(jwtTokenProvider.validateToken("rt")).thenReturn(true);
        when(jwtTokenProvider.getUserSeq("rt")).thenReturn(42L);
        when(userService.findActiveBySeq(42L)).thenReturn(Optional.empty()); // 탈퇴/부재

        mvc.perform(post("/oauth2/token/refresh").cookie(refreshCookie("rt")))
                .andExpect(status().isUnauthorized());
        verify(jwtTokenProvider, never()).generateAccessToken(anyLong(), anyString());
    }

    @Test
    void 유효한_RT와_활성_사용자면_새_AT를_발급한다() throws Exception {
        when(jwtTokenProvider.validateToken("rt")).thenReturn(true);
        when(jwtTokenProvider.getUserSeq("rt")).thenReturn(42L);
        when(userService.findActiveBySeq(42L)).thenReturn(Optional.of(activeUser()));
        when(jwtTokenProvider.generateAccessToken(42L, "USER")).thenReturn("new-AT");

        mvc.perform(post("/oauth2/token/refresh").cookie(refreshCookie("rt")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-AT"));
    }

    @Test
    void 로그아웃은_RT_쿠키를_즉시_만료시킨다() throws Exception {
        mvc.perform(post("/oauth2/logout"))
                .andExpect(status().isNoContent())
                .andExpect(result -> {
                    String setCookie = result.getResponse().getHeader("Set-Cookie");
                    org.assertj.core.api.Assertions.assertThat(setCookie)
                            .contains("refresh_token=")
                            .contains("Max-Age=0")
                            .contains("Path=/api/oauth2/token/refresh");
                });
    }
}
