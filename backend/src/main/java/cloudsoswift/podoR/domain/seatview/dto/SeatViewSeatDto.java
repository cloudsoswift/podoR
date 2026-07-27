package cloudsoswift.podoR.domain.seatview.dto;

import cloudsoswift.podoR.domain.event.entity.EventSeat;

/** seat-view 좌석 1건. record 라 Jackson 직렬화/역직렬화(Redis 캐시) 모두 가능. */
public record SeatViewSeatDto(
        Long eventSeatSeq,
        String section,
        String rowNumber,
        Integer seatNumber,
        String grade,
        Integer price,
        String status,
        Long changeVersion
) {
    public static SeatViewSeatDto from(EventSeat es) {
        return new SeatViewSeatDto(
                es.getSeq(),
                es.getSeat().getSection(),
                es.getSeat().getRowNumber(),
                es.getSeat().getSeatNumber(),
                es.getSeatGrade(),
                es.getPrice(),
                es.getStatus().name(),
                es.getChangeVersion());
    }
}
