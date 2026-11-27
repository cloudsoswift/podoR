package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.domain.ticketing.payment.OrderConfirmFailedException;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentGatewayException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 예매·결제 공통 예외 → ProblemDetail(detail 에 사용자용 문구).
 * 컨트롤러에 남아 있는 핸들러(취소 불가, 낙관적 락)와 예외 타입이 겹치지 않는다.
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
}
