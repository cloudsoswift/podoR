package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class HoldRequest {
    private List<Long> eventSeatSeqs;
}
