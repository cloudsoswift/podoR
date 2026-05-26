package cloudsoswift.podoR.domain.concerthall.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ConcertHallUpdateRequest {
    private String name;
    private String address;
    private String description;
    private String concertHallImage;
}
