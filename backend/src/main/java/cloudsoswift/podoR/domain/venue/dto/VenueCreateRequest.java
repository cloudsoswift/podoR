package cloudsoswift.podoR.domain.venue.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class VenueCreateRequest {
    private String name;
    private String address;
    private String description;
    private String venueImage;
}
