package cloudsoswift.podoR.domain.event.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class EventCreateRequest {
    private String title;
    private String content;
    private String eventType;
    private LocalDateTime eventDate;
    private LocalDateTime ticketingDate;
    private Long venueSeq;
}
