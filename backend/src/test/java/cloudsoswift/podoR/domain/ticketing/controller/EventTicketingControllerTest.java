package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.ticketing.dto.HoldResponse;
import cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse;
import cloudsoswift.podoR.domain.ticketing.dto.SeatQuotaResponse;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = EventTicketingController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class EventTicketingControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean TicketingOrderService service;

    static final Authentication AUTH = new UsernamePasswordAuthenticationToken(
            100L, "t", List.of(new SimpleGrantedAuthority("ROLE_USER")));

    @Test
    void getMyQuota_200_json_그리고_principal_userSeq_전달() throws Exception {
        when(service.getMyQuota("EVT1", 100L)).thenReturn(new SeatQuotaResponse(2, 4));

        mvc.perform(get("/events/EVT1/my-seat-quota").principal(AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.used").value(2))
                .andExpect(jsonPath("$.max").value(4));
        verify(service).getMyQuota("EVT1", 100L);
    }

    @Test
    void hold_바디바인딩_principal전달_200_heldSeats() throws Exception {
        when(service.hold("EVT1", 100L, List.of(1L, 2L)))
                .thenReturn(new HoldResponse(List.of(1L, 2L), LocalDateTime.now().plusMinutes(5)));

        mvc.perform(post("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1,2]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heldSeats[0]").value(1))
                .andExpect(jsonPath("$.heldSeats[1]").value(2));
        verify(service).hold("EVT1", 100L, List.of(1L, 2L));
    }

    @Test
    void hold_서비스가_ResponseStatusException_CONFLICT면_409() throws Exception {
        when(service.hold(anyString(), anyLong(), anyList()))
                .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "conflict"));

        mvc.perform(post("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void releaseHolds_바디의_좌석으로_해제_204() throws Exception {
        mvc.perform(delete("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1,2]}"))
                .andExpect(status().isNoContent());
        verify(service).releaseHolds("EVT1", 100L, List.of(1L, 2L));
    }

    @Test
    void createOrder_바디바인딩_200_orderNumber() throws Exception {
        when(service.confirmOrder("EVT1", 100L, List.of(1L, 2L), "MOCK"))
                .thenReturn(new OrderCreatedResponse("ORD-1"));

        mvc.perform(post("/events/EVT1/order").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1,2],\"paymentMethod\":\"MOCK\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value("ORD-1"));
        verify(service).confirmOrder("EVT1", 100L, List.of(1L, 2L), "MOCK");
    }

    @Test
    void cancelOrder_pathVariable_주문번호로_취소_204() throws Exception {
        mvc.perform(delete("/events/EVT1/order/ORD-1").principal(AUTH))
                .andExpect(status().isNoContent());
        verify(service).cancelOrder(100L, "ORD-1");
    }
}
