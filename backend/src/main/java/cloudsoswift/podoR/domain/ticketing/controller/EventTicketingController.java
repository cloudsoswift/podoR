package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.domain.ticketing.dto.CancelItemsRequest;
import cloudsoswift.podoR.domain.ticketing.dto.ConfirmOrderRequest;
import cloudsoswift.podoR.domain.ticketing.dto.CreateOrderRequest;
import cloudsoswift.podoR.domain.ticketing.dto.FailOrderRequest;
import cloudsoswift.podoR.domain.ticketing.dto.HoldRequest;
import cloudsoswift.podoR.domain.ticketing.dto.HoldResponse;
import cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse;
import cloudsoswift.podoR.domain.ticketing.dto.PreparedOrderResponse;
import cloudsoswift.podoR.domain.ticketing.dto.SeatQuotaResponse;
import cloudsoswift.podoR.domain.ticketing.service.PaymentConfirmService;
import cloudsoswift.podoR.domain.ticketing.service.TicketingOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}")
public class EventTicketingController {

    private final TicketingOrderService ticketingOrderService;
    private final PaymentConfirmService paymentConfirmService;

    @PostMapping("/holds")
    public ResponseEntity<HoldResponse> hold(@PathVariable String eventId,
                                             @RequestBody HoldRequest request,
                                             Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ticketingOrderService.hold(eventId, userSeq, request.getEventSeatSeqs()));
    }

    @DeleteMapping("/holds")
    public ResponseEntity<Void> releaseHolds(@PathVariable String eventId,
                                             @RequestBody HoldRequest request,
                                             Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        ticketingOrderService.releaseHolds(eventId, userSeq, request.getEventSeatSeqs());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my-seat-quota")
    public ResponseEntity<SeatQuotaResponse> mySeatQuota(@PathVariable String eventId,
                                                         Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ticketingOrderService.getMyQuota(eventId, userSeq));
    }

    /** 결제 준비: PENDING 주문을 만들고 토스 결제창에 넘길 주문번호·금액·주문명을 돌려준다. */
    @PostMapping("/order")
    public ResponseEntity<PreparedOrderResponse> createOrder(@PathVariable String eventId,
                                                             @RequestBody CreateOrderRequest request,
                                                             Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ticketingOrderService.prepareOrder(eventId, userSeq, request.getEventSeatSeqs()));
    }

    /**
     * 결제 확정: 토스 successUrl 에서 받은 paymentKey·금액으로 승인하고 좌석을 판다.
     * 입장권 게이트는 /events/{eventId}/order 단일 경로만 보므로 이 경로는 걸리지 않는다 — 결제 중 입장권이 만료돼도 확정된다.
     */
    @PostMapping("/order/{orderNumber}/confirm")
    public ResponseEntity<OrderCreatedResponse> confirmOrder(@PathVariable String eventId,
                                                             @PathVariable String orderNumber,
                                                             @RequestBody ConfirmOrderRequest request,
                                                             Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        if (request.getPaymentKey() == null || request.getPaymentKey().isBlank() || request.getAmount() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentKey 와 amount 가 필요합니다.");
        }
        return ResponseEntity.ok(paymentConfirmService.confirm(
                eventId, userSeq, orderNumber, request.getPaymentKey(), request.getAmount()));
    }

    /** 결제 실패·취소 기록(토스 failUrl). 선점은 유지한다. */
    @PostMapping("/order/{orderNumber}/fail")
    public ResponseEntity<Void> failOrder(@PathVariable String eventId,
                                          @PathVariable String orderNumber,
                                          @RequestBody FailOrderRequest request,
                                          Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        paymentConfirmService.fail(eventId, userSeq, orderNumber, request.getCode(), request.getMessage());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/order/{orderNumber}")
    public ResponseEntity<Void> cancelOrder(@PathVariable String eventId,
                                            @PathVariable String orderNumber,
                                            Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        ticketingOrderService.cancelOrder(userSeq, orderNumber);
        return ResponseEntity.noContent().build();
    }

    /** 부분 취소: 고른 좌석(주문 항목)만 취소한다. */
    @PostMapping("/order/{orderNumber}/cancel")
    public ResponseEntity<Void> cancelOrderItems(@PathVariable String eventId,
                                                 @PathVariable String orderNumber,
                                                 @RequestBody CancelItemsRequest request,
                                                 Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        ticketingOrderService.cancelItems(userSeq, orderNumber, request.getTicketingItemSeqs());
        return ResponseEntity.noContent().build();
    }
}
