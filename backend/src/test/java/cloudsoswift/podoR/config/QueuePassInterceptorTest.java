package cloudsoswift.podoR.config;

import cloudsoswift.podoR.domain.queue.WaitingQueueService;
import cloudsoswift.podoR.domain.seatview.controller.SeatViewController;
import cloudsoswift.podoR.domain.seatview.dto.SeatViewResponse;
import cloudsoswift.podoR.domain.seatview.ratelimit.SeatViewRateLimiter;
import cloudsoswift.podoR.domain.seatview.service.SeatViewService;
import cloudsoswift.podoR.domain.ticketing.controller.EventTicketingController;
import cloudsoswift.podoR.domain.ticketing.service.TicketingOrderService;
import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 입장권 게이트가 어떤 경로를 막고 어떤 경로를 통과시키는지 검증한다.
 * SecurityConfig 는 제외하고(인가는 별도 관심사) WebMvcConfig + QueuePassInterceptor 는 진짜를 쓴다.
 */
@WebMvcTest(controllers = {SeatViewController.class, EventTicketingController.class},
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@Import({WebMvcConfig.class, QueuePassInterceptor.class})
@AutoConfigureMockMvc(addFilters = false)
class QueuePassInterceptorTest {

    @Autowired MockMvc mvc;
    @MockitoBean WaitingQueueService waitingQueue;
    @MockitoBean SeatViewService seatViewService;
    @MockitoBean SeatViewRateLimiter rateLimiter;
    @MockitoBean TicketingOrderService ticketingOrderService;

    static final Authentication AUTH = new UsernamePasswordAuthenticationToken(
            100L, "t", List.of(new SimpleGrantedAuthority("ROLE_USER")));

    @Test
    void 입장권이_없으면_403_과_ProblemDetail_detail_을_돌려준다() throws Exception {
        when(waitingQueue.hasValidPass("EVT1", 100L)).thenReturn(false);

        mvc.perform(get("/events/EVT1/seat-view").principal(AUTH))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("입장 대기가 필요합니다."));

        verifyNoInteractions(seatViewService); // 컨트롤러까지 가지 않는다
    }

    @Test
    void 입장권이_있으면_컨트롤러까지_통과한다() throws Exception {
        when(waitingQueue.hasValidPass("EVT1", 100L)).thenReturn(true);
        // SeatViewResponse 는 record 라 목보다 실제 인스턴스가 낫다
        when(seatViewService.getSnapshot("EVT1")).thenReturn(
                new SeatViewResponse("EVT1", 0L, "{}", List.of(), List.of()));

        mvc.perform(get("/events/EVT1/seat-view").principal(AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value("EVT1"));
        verify(seatViewService).getSnapshot("EVT1");
    }

    @Test
    void 게이트는_seat_view_changes_와_quota_와_holds_와_order_에도_걸린다() throws Exception {
        when(waitingQueue.hasValidPass(anyString(), anyLong())).thenReturn(false);

        mvc.perform(get("/events/EVT1/seat-view/changes").principal(AUTH))
                .andExpect(status().isForbidden());
        mvc.perform(get("/events/EVT1/my-seat-quota").principal(AUTH))
                .andExpect(status().isForbidden());
        mvc.perform(post("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1]}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/events/EVT1/order").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1],\"paymentMethod\":\"MOCK\"}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(ticketingOrderService);
    }

    @Test
    void 주문_취소는_게이트에서_제외되어_입장권_없이도_통과한다() throws Exception {
        // hasValidPass 를 스텁하지 않는 것이 핵심이다 — 게이트가 아예 호출되지 않아야 한다.
        // 마이페이지에서 대기 없이 취소할 수 있어야 한다.
        mvc.perform(delete("/events/EVT1/order/20260910-8C35D7AC").principal(AUTH))
                .andExpect(status().isNoContent());
        verify(ticketingOrderService).cancelOrder(100L, "20260910-8C35D7AC");
        verifyNoInteractions(waitingQueue);
    }
}
