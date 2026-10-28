package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;

@Getter
public class SeatQuotaResponse {
    private final long used; // 이 시리즈에서 내가 선점(held) + 예매완료(paid)한 좌석수
    private final int max;    // 이 시리즈 1인 최대 예매 가능 좌석수

    public SeatQuotaResponse(long used, int max) {
        this.used = used;
        this.max = max;
    }
}
