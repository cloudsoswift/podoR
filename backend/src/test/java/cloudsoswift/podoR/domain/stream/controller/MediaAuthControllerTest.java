package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.stream.media.MediaClaims;
import cloudsoswift.podoR.domain.stream.media.MediaCookieSigner;
import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = MediaAuthController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class,
                        cloudsoswift.podoR.config.WebMvcConfig.class,
                        cloudsoswift.podoR.config.QueuePassInterceptor.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class MediaAuthControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean MediaCookieSigner signer;

    static final Cookie COOKIE = new Cookie("podor_media", "tok");

    @BeforeEach
    void setUp() {
        when(signer.verify(eq("tok"), any())).thenReturn(
                Optional.of(new MediaClaims(5L, "E-1", Instant.now().plusSeconds(600))));
        when(signer.verify(eq("bad"), any())).thenReturn(Optional.empty());
    }

    private org.springframework.test.web.servlet.ResultActions authorize(String uri, Cookie... cookies) throws Exception {
        var req = get("/internal/media/authorize").header("X-Original-URI", uri);
        if (cookies.length > 0) req.cookie(cookies);
        return mvc.perform(req);
    }

    @Test
    void 같은_회차의_HLS_조각은_204() throws Exception {
        authorize("/media/hls/E-1/2/src/00003.ts", COOKIE).andExpect(status().isNoContent());
        authorize("/media/hls/E-1/2/master.m3u8", COOKIE).andExpect(status().isNoContent());
    }

    @Test
    void 같은_회차의_VOD_는_204() throws Exception {
        authorize("/media/vod/E-1.mp4", COOKIE).andExpect(status().isNoContent());
    }

    @Test
    void 다른_회차는_403() throws Exception {
        authorize("/media/hls/E-2/1/master.m3u8", COOKIE).andExpect(status().isForbidden());
        authorize("/media/vod/E-2.mp4", COOKIE).andExpect(status().isForbidden());
        authorize("/media/other/E-1.mp4", COOKIE).andExpect(status().isForbidden());
    }

    @Test
    void 점점_경로는_403() throws Exception {
        authorize("/media/hls/E-1/../E-2/1/master.m3u8", COOKIE).andExpect(status().isForbidden());
    }

    @Test
    void 쿠키_없으면_401() throws Exception {
        authorize("/media/hls/E-1/1/master.m3u8").andExpect(status().isUnauthorized());
        authorize("/media/hls/E-1/1/master.m3u8", new Cookie("podor_media", "bad"))
                .andExpect(status().isUnauthorized());
    }
}
