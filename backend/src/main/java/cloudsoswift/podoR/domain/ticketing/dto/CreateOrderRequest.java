package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class CreateOrderRequest {
    private List<Long> eventSeatSeqs;
    private String paymentMethod;   // "MOCK"
}
