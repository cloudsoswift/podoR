package cloudsoswift.podoR.domain.queue.controller;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.queue.QueueStatus;
import cloudsoswift.podoR.domain.queue.TicketingQueueService;
import cloudsoswift.podoR.domain.queue.dto.QueueStatusResponse;
import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// @WebMvcTest 는 WebMvcConfigurer 와 HandlerInterceptor 를 자동으로 끌어온다.
// 둘 다 제외하지 않으면 WaitingQueueService 빈이 없어 컨텍스트가 뜨지 않는다.
// 이 테스트의 관심사는 컨트롤러 매핑이지 게이트가 아니다(게이트는 QueuePassInterceptorTest).
@WebMvcTest(value = WaitingQueueController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class,
                        cloudsoswift.podoR.config.WebMvcConfig.class,
                        cloudsoswift.podoR.config.QueuePassInterceptor.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class WaitingQueueControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean TicketingQueueService service;

    static final Authentication AUTH = new UsernamePasswordAuthenticationToken(
            100L, "t", List.of(new SimpleGrantedAuthority("ROLE_USER")));

    @Test
    void 대기중이면_200_에_status_position_ahead_가_실린다() throws Exception {
        when(service.enterOrPoll("EVT1", 100L)).thenReturn(new QueueStatusResponse(
                QueueStatus.WAITING, 42L, 41L, null, LocalDateTime.of(2026, 9, 13, 10, 0)));

        mvc.perform(post("/events/EVT1/queue").principal(AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WAITING"))
                .andExpect(jsonPath("$.position").value(42))
                .andExpect(jsonPath("$.ahead").value(41))
                .andExpect(jsonPath("$.passExpiresAt").doesNotExist());
        verify(service).enterOrPoll("EVT1", 100L);
    }

    @Test
    void 오픈_전이면_NOT_OPEN_과_opensAt_이_실린다() throws Exception {
        when(service.enterOrPoll("EVT1", 100L)).thenReturn(new QueueStatusResponse(
                QueueStatus.NOT_OPEN, null, null, null, LocalDateTime.of(2026, 9, 13, 10, 0)));

        mvc.perform(post("/events/EVT1/queue").principal(AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_OPEN"))
                .andExpect(jsonPath("$.opensAt").value("2026-09-13T10:00:00"));
    }

    @Test
    void 이탈은_204_이고_principal_userSeq_가_전달된다() throws Exception {
        mvc.perform(delete("/events/EVT1/queue").principal(AUTH))
                .andExpect(status().isNoContent());
        verify(service).leave("EVT1", 100L);
    }

    @Test
    void 없는_이벤트면_404() throws Exception {
        when(service.enterOrPoll("NOPE", 100L))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: NOPE"));

        mvc.perform(post("/events/NOPE/queue").principal(AUTH))
                .andExpect(status().isNotFound());
    }
}
