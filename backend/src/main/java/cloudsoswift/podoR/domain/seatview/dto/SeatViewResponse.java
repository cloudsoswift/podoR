package cloudsoswift.podoR.domain.seatview.dto;

import java.util.List;

/**
 * 전체 스냅샷. layoutJson 으로 섹션/비가용 좌석까지 렌더, seats 로 판매 상태 오버레이.
 * record 라 Redis 캐시 역직렬화 가능.
 */
public record SeatViewResponse(
        String eventId,
        long cursor,          // 현재 max change_version
        String layoutJson,    // VenueLayout SeatmapDoc (없으면 null)
        List<SeatViewSeatDto> seats
) {
}
