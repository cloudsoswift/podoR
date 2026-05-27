package cloudsoswift.podoR.domain.event.security;

import cloudsoswift.podoR.domain.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component("eventSecurity")
@RequiredArgsConstructor
public class EventSecurity {

    private final EventRepository eventRepository;

    public boolean isOwner(String eventId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userSeq)) return false;
        return eventRepository.existsByEventIdAndHost_SeqAndDeletedDateIsNull(eventId, userSeq);
    }
}
