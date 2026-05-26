package cloudsoswift.podoR.domain.concerthall.dto;

import cloudsoswift.podoR.domain.concerthall.entity.ConcertHall;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class ConcertHallResponse {
    private Long seq;
    private String name;
    private String address;
    private String description;
    private String concertHallImage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ConcertHallResponse(ConcertHall concertHall) {
        this.seq = concertHall.getSeq();
        this.name = concertHall.getName();
        this.address = concertHall.getAddress();
        this.description = concertHall.getDescription();
        this.concertHallImage = concertHall.getConcertHallImage();
        this.createdAt = concertHall.getCreatedAt();
        this.updatedAt = concertHall.getUpdatedAt();
    }
}
