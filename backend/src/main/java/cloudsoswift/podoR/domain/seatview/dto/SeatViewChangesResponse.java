package cloudsoswift.podoR.domain.seatview.dto;

import java.util.List;

/** 증분 응답 + 현재 선점 좌석(heldSeats). */
public record SeatViewChangesResponse(
        long cursor,
        List<SeatViewSeatDto> seats,
        List<Long> heldSeats
) {
}
