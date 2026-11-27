package cloudsoswift.podoR.domain.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateOrderRequest {
    private List<Long> eventSeatSeqs;
}
