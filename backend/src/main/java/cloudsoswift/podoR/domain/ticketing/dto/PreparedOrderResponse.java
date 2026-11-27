package cloudsoswift.podoR.domain.ticketing.dto;

/** 결제 준비 응답: 토스 결제창을 열 때 쓰는 주문번호·금액·주문명. */
public record PreparedOrderResponse(String orderNumber, int amount, String orderName) {
}
