package cloudsoswift.podoR.domain.seatview.dto;

import java.util.List;

/** 증분 응답. */
public record SeatViewChangesResponse(
        long cursor,   // 이번 응답 max change_version (없으면 요청 since 유지)
        List<SeatViewSeatDto> seats
) {
}
