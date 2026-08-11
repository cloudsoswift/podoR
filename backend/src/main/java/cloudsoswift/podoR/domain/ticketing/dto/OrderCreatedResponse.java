package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;

@Getter
public class OrderCreatedResponse {
    private final String orderNumber;

    public OrderCreatedResponse(String orderNumber) {
        this.orderNumber = orderNumber;
    }
}
