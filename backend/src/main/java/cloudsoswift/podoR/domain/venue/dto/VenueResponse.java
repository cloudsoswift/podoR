package cloudsoswift.podoR.domain.venue.dto;

import cloudsoswift.podoR.domain.venue.entity.Venue;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class VenueResponse {
    private Long seq;
    private String name;
    private String address;
    private String description;
    private String venueImage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public VenueResponse(Venue venue) {
        this.seq = venue.getSeq();
        this.name = venue.getName();
        this.address = venue.getAddress();
        this.description = venue.getDescription();
        this.venueImage = venue.getVenueImage();
        this.createdAt = venue.getCreatedAt();
        this.updatedAt = venue.getUpdatedAt();
    }
}
