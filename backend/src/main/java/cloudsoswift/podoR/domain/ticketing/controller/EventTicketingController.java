package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.domain.ticketing.dto.CancelItemsRequest;
import cloudsoswift.podoR.domain.ticketing.dto.CreateOrderRequest;
import cloudsoswift.podoR.domain.ticketing.dto.HoldRequest;
import cloudsoswift.podoR.domain.ticketing.dto.HoldResponse;
import cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse;
import cloudsoswift.podoR.domain.ticketing.dto.SeatQuotaResponse;
import cloudsoswift.podoR.domain.ticketing.service.TicketingOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}")
public class EventTicketingController {

    private final TicketingOrderService ticketingOrderService;

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

    @PostMapping("/order")
    public ResponseEntity<OrderCreatedResponse> createOrder(@PathVariable String eventId,
                                                            @RequestBody CreateOrderRequest request,
                                                            Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ticketingOrderService.confirmOrder(
                eventId, userSeq, request.getEventSeatSeqs(), request.getPaymentMethod()));
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

    /** 같은 주문을 동시에 취소(다른 탭, 공연장 배치 변경 등)해 낙관적 락이 실패하면 409. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ProblemDetail handleConcurrentCancel(ObjectOptimisticLockingFailureException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "다른 요청과 동시에 처리되었습니다. 예매 내역을 다시 확인해 주세요.");
    }
}
