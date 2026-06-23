package cloudsoswift.podoR.domain.event.dto;

import lombok.Getter;

import java.time.LocalDateTime;

/** 공연 목록 카드(시리즈 대표 1건 + 회차 수). */
@Getter
public class ConcertSummaryResponse {
    private final String seriesId;
    private final String representativeEventId; // 가장 이른 회차의 eventId
    private final String title;
    private final String eventType;
    private final String venueName;
    private final LocalDateTime earliestEventDate;
    private final long sessionCount;

    public ConcertSummaryResponse(String seriesId, String representativeEventId, String title,
                                  String eventType, String venueName,
                                  LocalDateTime earliestEventDate, long sessionCount) {
        this.seriesId = seriesId;
        this.representativeEventId = representativeEventId;
        this.title = title;
        this.eventType = eventType;
        this.venueName = venueName;
        this.earliestEventDate = earliestEventDate;
        this.sessionCount = sessionCount;
    }
}
