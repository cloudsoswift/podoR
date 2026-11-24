package cloudsoswift.podoR.domain.ticketing.entity;

/** 예매 항목 취소 사유. */
public enum CancelReason {
    /** 관객이 직접 취소. 환불 정책의 마감·수수료 규칙을 따른다. */
    USER,
    /** 공연장 좌석 배치 변경으로 취소. 마감과 무관하게 전액 환불. */
    VENUE_CHANGE
}
