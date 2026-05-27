package cloudsoswift.podoR.domain.venue.dto;

import cloudsoswift.podoR.domain.venue.entity.VenueLayout;
import lombok.Getter;

@Getter
public class VenueLayoutResponse {
    private Long seq;
    private Long venueSeq;
    private String layoutJson;

    public VenueLayoutResponse(VenueLayout layout) {
        this.seq = layout.getSeq();
        this.venueSeq = layout.getVenue().getSeq();
        this.layoutJson = layout.getLayoutJson();
    }
}
