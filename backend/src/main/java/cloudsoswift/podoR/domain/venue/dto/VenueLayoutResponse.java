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

    private VenueLayoutResponse(Long venueSeq) {
        this.seq = null;
        this.venueSeq = venueSeq;
        this.layoutJson = null;
    }

    /** 레이아웃이 아직 없는 venue 용 빈 응답(신규 공연장 = 빈 에디터). */
    public static VenueLayoutResponse empty(Long venueSeq) {
        return new VenueLayoutResponse(venueSeq);
    }
}
