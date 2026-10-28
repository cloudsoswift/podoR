package cloudsoswift.podoR.domain.seatview.dto;

import java.util.List;

/** 전체 스냅샷 + 실시간 선점(heldSeats). record 라 Redis 캐시 역직렬화 가능. */
public record SeatViewResponse(
        String eventId,
        long cursor,
        String layoutJson,
        List<SeatViewSeatDto> seats,
        List<Long> heldSeats
) {
}
