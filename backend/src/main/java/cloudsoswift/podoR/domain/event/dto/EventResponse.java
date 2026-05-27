package cloudsoswift.podoR.domain.event.dto;

import cloudsoswift.podoR.domain.event.entity.Event;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class EventResponse {
    private Long seq;
    private String eventId;
    private String title;
    private String content;
    private String eventType;
    private LocalDateTime eventDate;
    private LocalDateTime ticketingDate;
    private String streamStatus;
    private LocalDateTime createdDate;
    private Long venueSeq;
    private String venueName;
    private Long hostSeq;
    private String hostNickname;

    public EventResponse(Event event) {
        this.seq = event.getSeq();
        this.eventId = event.getEventId();
        this.title = event.getTitle();
        this.content = event.getContent();
        this.eventType = event.getEventType();
        this.eventDate = event.getEventDate();
        this.ticketingDate = event.getTicketingDate();
        this.streamStatus = event.getStreamStatus();
        this.createdDate = event.getCreatedDate();
        this.venueSeq = event.getVenue().getSeq();
        this.venueName = event.getVenue().getName();
        this.hostSeq = event.getHost().getSeq();
        this.hostNickname = event.getHost().getNickname();
    }
}
