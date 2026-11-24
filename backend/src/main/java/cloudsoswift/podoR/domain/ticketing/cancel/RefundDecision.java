package cloudsoswift.podoR.domain.ticketing.cancel;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 환불 정책의 판단.
 *
 * @param allowed       취소 허용 여부
 * @param deniedMessage 거절 사유(사용자에게 그대로 보인다). 허용이면 null
 * @param refunds       좌석별 환불액. 거절이면 비어 있다
 */
public record RefundDecision(boolean allowed, String deniedMessage, Map<TicketingItem, Integer> refunds) {

    public static RefundDecision denied(String message) {
        return new RefundDecision(false, message, Map.of());
    }

    public static RefundDecision fullRefund(List<TicketingItem> items) {
        Map<TicketingItem, Integer> refunds = new LinkedHashMap<>();
        for (TicketingItem i : items) refunds.put(i, i.getPrice());
        return new RefundDecision(true, null, refunds);
    }

    public int refundOf(TicketingItem item) {
        Integer refund = refunds.get(item);
        if (refund == null) throw new IllegalArgumentException("환불액이 정해지지 않은 항목입니다.");
        return refund;
    }
}
