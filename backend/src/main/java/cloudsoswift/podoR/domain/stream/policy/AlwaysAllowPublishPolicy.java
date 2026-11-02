package cloudsoswift.podoR.domain.stream.policy;

import cloudsoswift.podoR.domain.event.entity.Event;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class AlwaysAllowPublishPolicy implements StreamPublishPolicy {
    @Override
    public boolean allows(Event event, LocalDateTime now) {
        return true;
    }
}
