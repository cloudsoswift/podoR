package cloudsoswift.podoR.domain.ticketing.dto;

import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
public class HoldResponse {
    private final List<Long> heldSeats;
    private final LocalDateTime expiresAt;

    public HoldResponse(List<Long> heldSeats, LocalDateTime expiresAt) {
        this.heldSeats = heldSeats;
        this.expiresAt = expiresAt;
    }
}
