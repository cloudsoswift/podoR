package cloudsoswift.podoR.domain.ticketing.payment;

/** 승인 결과. method 는 결제수단(토스 응답 {@code method}, mock 은 "MOCK"). */
public record ConfirmResult(String method) {
}
