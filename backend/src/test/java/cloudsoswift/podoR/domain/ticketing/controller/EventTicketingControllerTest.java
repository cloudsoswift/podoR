package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.config.SecurityConfig;
import cloudsoswift.podoR.domain.ticketing.dto.HoldResponse;
import cloudsoswift.podoR.domain.ticketing.dto.PreparedOrderResponse;
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
        // @WebMvcTest 는 WebMvcConfigurer 와 HandlerInterceptor 를 자동으로 끌어온다.
        // 둘 다 제외하지 않으면 WaitingQueueService 빈이 없어 컨텍스트가 뜨지 않는다.
        // (게이트 동작 자체는 QueuePassInterceptorTest 소관이다.)
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = {SecurityConfig.class, JwtAuthenticationFilter.class,
                        cloudsoswift.podoR.config.WebMvcConfig.class,
                        cloudsoswift.podoR.config.QueuePassInterceptor.class}),
        excludeAutoConfiguration = {OAuth2ClientAutoConfiguration.class,
                OAuth2ClientWebSecurityAutoConfiguration.class})
@AutoConfigureMockMvc(addFilters = false)
class EventTicketingControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean TicketingOrderService service;
    @MockitoBean cloudsoswift.podoR.domain.ticketing.service.PaymentConfirmService confirmService;

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

    /**
     * 실패 사유가 응답에 실려야 클라이언트가 "왜 409 인지"를 사용자에게 보여줄 수 있다.
     * (ProblemDetail 비활성 상태에서는 사유가 잘려나가 모든 409 가 구분 불가능했다.)
     */
    @Test
    void hold_실패_사유가_ProblemDetail_detail_로_전달된다() throws Exception {
        when(service.hold(anyString(), anyLong(), anyList()))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.CONFLICT, "이 공연은 1인 최대 4석까지 예매할 수 있습니다."));

        mvc.perform(post("/events/EVT1/holds").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이 공연은 1인 최대 4석까지 예매할 수 있습니다."));
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
    void POST_order_는_orderNumber_amount_orderName_을_돌려준다() throws Exception {
        when(service.prepareOrder("EVT1", 100L, List.of(1L, 2L)))
                .thenReturn(new PreparedOrderResponse("ORD-1", 30000, "공연 (2석)"));

        mvc.perform(post("/events/EVT1/order").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventSeatSeqs\":[1,2],\"paymentMethod\":\"MOCK\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNumber").value("ORD-1"))
                .andExpect(jsonPath("$.amount").value(30000))
                .andExpect(jsonPath("$.orderName").value("공연 (2석)"));
        verify(service).prepareOrder("EVT1", 100L, List.of(1L, 2L));
    }

    @Test
    void cancelOrder_pathVariable_주문번호로_취소_204() throws Exception {
        mvc.perform(delete("/events/EVT1/order/ORD-1").principal(AUTH))
                .andExpect(status().isNoContent());
        verify(service).cancelOrder(100L, "ORD-1");
    }

    @Test
    void cancelItems_바디의_항목만_취소_204() throws Exception {
        mvc.perform(post("/events/EVT1/order/O1/cancel").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ticketingItemSeqs\":[11,12]}"))
                .andExpect(status().isNoContent());
        verify(service).cancelItems(100L, "O1", List.of(11L, 12L));
    }

    @Test
    void 같은_주문을_동시에_취소해_낙관적락이_실패하면_409() throws Exception {
        doThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(
                cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder.class, 1L))
                .when(service).cancelItems(anyLong(), anyString(), anyList());

        mvc.perform(post("/events/EVT1/order/O1/cancel").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ticketingItemSeqs\":[11]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void 취소_마감이면_400과_사유() throws Exception {
        doThrow(new cloudsoswift.podoR.domain.ticketing.cancel.CancellationNotAllowedException(
                "공연 시작 30분 전부터는 취소할 수 없습니다."))
                .when(service).cancelItems(anyLong(), anyString(), anyList());

        mvc.perform(post("/events/EVT1/order/O1/cancel").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ticketingItemSeqs\":[11]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("공연 시작 30분 전부터는 취소할 수 없습니다."));
    }

    @Test
    void RefundFailedException_은_502_와_주문번호_목록() throws Exception {
        doThrow(new cloudsoswift.podoR.domain.ticketing.cancel.RefundFailedException(List.of(
                new cloudsoswift.podoR.domain.ticketing.cancel.FailedRefund("O1", "EVT1", "PROVIDER_ERROR", "오류"),
                new cloudsoswift.podoR.domain.ticketing.cancel.FailedRefund("O2", "EVT1", "X", "m"))))
                .when(service).cancelItems(anyLong(), anyString(), anyList());

        mvc.perform(post("/events/EVT1/order/O1/cancel").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ticketingItemSeqs\":[11]}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("환불에 실패한 예매가 있습니다: O1, O2"))
                .andExpect(jsonPath("$.failures[0].orderNumber").value("O1"))
                .andExpect(jsonPath("$.failures[0].eventId").value("EVT1"))
                .andExpect(jsonPath("$.failures[0].code").value("PROVIDER_ERROR"))
                .andExpect(jsonPath("$.failures[1].message").value("m"));
    }

    @Test
    void confirm_은_200() throws Exception {
        when(confirmService.confirm("EVT1", 100L, "ORD-1", "pk-1", 30000L))
                .thenReturn(new cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse("ORD-1"));

        mvc.perform(post("/events/EVT1/order/ORD-1/confirm").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentKey\":\"pk-1\",\"amount\":30000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value("ORD-1"));
        verify(confirmService).confirm("EVT1", 100L, "ORD-1", "pk-1", 30000L);
    }

    @Test
    void confirm_에_paymentKey_나_amount_가_없으면_400() throws Exception {
        mvc.perform(post("/events/EVT1/order/ORD-1/confirm").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":30000}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/events/EVT1/order/ORD-1/confirm").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentKey\":\"pk-1\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(confirmService);
    }

    @Test
    void OrderConfirmFailedException_은_ProblemDetail_detail() throws Exception {
        when(confirmService.confirm(anyString(), anyLong(), anyString(), anyString(), anyLong()))
                .thenThrow(new cloudsoswift.podoR.domain.ticketing.payment.OrderConfirmFailedException(
                        HttpStatus.BAD_REQUEST, "AMOUNT_MISMATCH", "결제 금액이 주문 금액과 다릅니다."));

        mvc.perform(post("/events/EVT1/order/ORD-1/confirm").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentKey\":\"pk-1\",\"amount\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("결제 금액이 주문 금액과 다릅니다."));
    }

    @Test
    void PaymentGatewayException_은_502_와_토스_메시지() throws Exception {
        when(confirmService.confirm(anyString(), anyLong(), anyString(), anyString(), anyLong()))
                .thenThrow(new cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException(
                        "REJECT_CARD_PAYMENT", "한도초과"));

        mvc.perform(post("/events/EVT1/order/ORD-1/confirm").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentKey\":\"pk-1\",\"amount\":30000}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("한도초과"));
    }

    @Test
    void fail_은_204_와_코드_메시지_전달() throws Exception {
        mvc.perform(post("/events/EVT1/order/ORD-1/fail").principal(AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"PAY_PROCESS_CANCELED\",\"message\":\"취소됨\"}"))
                .andExpect(status().isNoContent());
        verify(confirmService).fail("EVT1", 100L, "ORD-1", "PAY_PROCESS_CANCELED", "취소됨");
    }
}
