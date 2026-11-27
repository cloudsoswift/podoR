package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.domain.ticketing.cancel.CancellationNotAllowedException;
import cloudsoswift.podoR.domain.ticketing.cancel.RefundFailedException;
import cloudsoswift.podoR.domain.ticketing.payment.OrderConfirmFailedException;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 예매·결제·취소 공통 예외 → ProblemDetail(detail 에 사용자용 문구).
 * 컨트롤러 안의 @ExceptionHandler 가 있으면 그쪽이 먼저다(예: 좌석맵 저장의 낙관적 락 409 {message}).
 */
@Slf4j
@RestControllerAdvice
public class TicketingExceptionHandler {

    /** 확정 검증 실패(금액 불일치 400, 선점 만료·좌석 판매됨 409). */
    @ExceptionHandler(OrderConfirmFailedException.class)
    public ProblemDetail handleConfirmFailed(OrderConfirmFailedException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(e.getStatus(), e.getMessage());
        pd.setProperty("code", e.getCode());
        return pd;
    }

    /** PG 승인/취소 실패: 502, detail 은 PG 메시지. */
    @ExceptionHandler(PaymentGatewayException.class)
    public ProblemDetail handleGateway(PaymentGatewayException e) {
        log.warn("결제 대행사 오류 code={} message={}", e.code(), e.getMessage());
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, e.getMessage());
        pd.setProperty("code", e.code());
        return pd;
    }

    /** 환불 정책이 취소를 거절하면(예: 공연 시작 30분 전) 400 과 사유. */
    @ExceptionHandler(CancellationNotAllowedException.class)
    public ProblemDetail handleCancellationNotAllowed(CancellationNotAllowedException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    /** 같은 주문을 동시에 취소(다른 탭, 공연장 배치 변경 등)해 낙관적 락이 실패하면 409. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ProblemDetail handleConcurrentCancel(ObjectOptimisticLockingFailureException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "다른 요청과 동시에 처리되었습니다. 예매 내역을 다시 확인해 주세요.");
    }

    /** 공연장 배치 변경 일괄 취소 중 일부 환불 실패: 502, failures 에 주문번호·회차·PG 사유. */
    @ExceptionHandler(RefundFailedException.class)
    public ProblemDetail handleRefundFailed(RefundFailedException e) {
        log.warn("배치 변경 환불 실패 {}", e.getFailures());
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, e.getMessage());
        pd.setProperty("failures", e.getFailures());
        return pd;
    }
}
