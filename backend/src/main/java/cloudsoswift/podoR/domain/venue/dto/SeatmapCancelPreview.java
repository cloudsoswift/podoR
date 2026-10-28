package cloudsoswift.podoR.domain.venue.dto;

import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 좌석맵 저장으로 취소될 예매 미리보기(409 본문).
 * 관리자가 확인한 cancelSeatCount 를 confirmedCancelSeatCount 로 다시 보내야 저장된다.
 */
@Getter
public class SeatmapCancelPreview {
    public static final String CODE = "SEATMAP_CANCEL_CONFIRM_REQUIRED";

    private final String code = CODE;
    private final int cancelSeatCount;
    private final int cancelOrderCount;
    private final List<EventItem> events;

    public SeatmapCancelPreview(int cancelSeatCount, int cancelOrderCount, List<EventItem> events) {
        this.cancelSeatCount = cancelSeatCount;
        this.cancelOrderCount = cancelOrderCount;
        this.events = events;
    }

    @Getter
    public static class EventItem {
        private final String eventId;
        private final String title;
        private final LocalDateTime eventDate;
        private final int seatCount;

        public EventItem(String eventId, String title, LocalDateTime eventDate, int seatCount) {
            this.eventId = eventId;
            this.title = title;
            this.eventDate = eventDate;
            this.seatCount = seatCount;
        }
    }
}
