package cloudsoswift.podoR.domain.venue.controller;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.venue.dto.SeatmapCancelPreview;
import cloudsoswift.podoR.domain.venue.service.SeatmapCancelConfirmRequiredException;
import cloudsoswift.podoR.domain.venue.service.VenueSeatmapService;
import cloudsoswift.podoR.security.jwt.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = VenueSeatmapController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class,
                        cloudsoswift.podoR.config.WebMvcConfig.class,
                        cloudsoswift.podoR.config.QueuePassInterceptor.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class VenueSeatmapControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean VenueSeatmapService service;

    @Test
    void 취소_확인이_필요하면_409_와_미리보기() throws Exception {
        SeatmapCancelPreview preview = new SeatmapCancelPreview(3, 2, List.of(
                new SeatmapCancelPreview.EventItem("E1", "공연", LocalDateTime.of(2026, 11, 1, 19, 0), 3)));
        when(service.register(eq(1L), any())).thenThrow(new SeatmapCancelConfirmRequiredException(preview));

        mvc.perform(post("/venues/1/seatmap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"layoutJson\":\"{}\",\"seats\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SEATMAP_CANCEL_CONFIRM_REQUIRED"))
                .andExpect(jsonPath("$.cancelSeatCount").value(3))
                .andExpect(jsonPath("$.cancelOrderCount").value(2))
                .andExpect(jsonPath("$.events[0].eventId").value("E1"))
                .andExpect(jsonPath("$.events[0].seatCount").value(3));
    }

    @Test
    void 예매_취소와_겹쳐_낙관적락이_실패하면_409() throws Exception {
        when(service.register(eq(1L), any())).thenThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(
                cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder.class, 1L));

        mvc.perform(post("/venues/1/seatmap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"layoutJson\":\"{}\",\"seats\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").exists());
    }
}
