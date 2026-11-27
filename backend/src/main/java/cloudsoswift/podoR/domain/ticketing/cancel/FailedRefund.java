package cloudsoswift.podoR.domain.ticketing.cancel;

/**
 * 공연장 배치 변경 일괄 취소에서 취소·환불에 실패한 주문 하나.
 *
 * @param code    PG 에러 코드(PG 밖의 실패면 예외 클래스 이름)
 * @param message PG 가 준 사유(또는 예외 메시지)
 */
public record FailedRefund(String orderNumber, String eventId, String code, String message) {
}
