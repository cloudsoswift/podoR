package cloudsoswift.podoR.domain.ticketing.cancel;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 공연장 배치 변경 일괄 취소 중 일부 주문의 취소·환불이 실패했다.
 * 성공한 주문은 각자 트랜잭션으로 이미 커밋됐고, 좌석맵 저장(바깥 트랜잭션)은 이 예외로 롤백된다.
 */
public class RefundFailedException extends RuntimeException {

    private final List<FailedRefund> failures;

    public RefundFailedException(List<FailedRefund> failures) {
        super("환불에 실패한 예매가 있습니다: "
                + failures.stream().map(FailedRefund::orderNumber).collect(Collectors.joining(", ")));
        this.failures = List.copyOf(failures);
    }

    public List<FailedRefund> getFailures() {
        return failures;
    }
}
