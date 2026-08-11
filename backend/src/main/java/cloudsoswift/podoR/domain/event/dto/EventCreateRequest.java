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
    private Integer maxSeatsPerPerson;   // 시리즈 1인 최대 좌석수(미지정 시 서비스 기본값)
}
