package cloudsoswift.podoR.domain.event.service;

import cloudsoswift.podoR.domain.event.cache.EventTicketingDateCache;
import cloudsoswift.podoR.domain.event.dto.EventUpdateRequest;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeriesRepository;
import cloudsoswift.podoR.domain.user.service.UserService;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.Mockito.*;

/**
 * 티켓팅 오픈 시각 캐시의 무효화 지점을 고정한다.
 *
 * 대기열 폴링은 `ticketingDate`를 캐시에서 읽으므로, 이벤트가 바뀌거나 삭제될 때
 * 캐시를 비우지 않으면 TTL(5분) 동안 이전 오픈 시각으로 판정하게 됨.
 */
@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock EventRepository eventRepository;
    @Mock VenueRepository venueRepository;
    @Mock UserService userService;
    @Mock EventSeriesRepository eventSeriesRepository;
    @Mock EventTicketingDateCache ticketingDateCache;

    @InjectMocks EventService service;

    static final String EVENT_ID = "EVT1";

    @Test
    void 이벤트를_수정하면_오픈시각_캐시를_비운다() {
        Event event = mock(Event.class);
        Venue venue = mock(Venue.class);
        // EventResponse가 venue, host를 타고 들어가므로 해당 객체들도 모킹함
        lenient().when(event.getVenue()).thenReturn(venue);
        lenient().when(event.getHost()).thenReturn(mock(cloudsoswift.podoR.domain.user.entity.User.class));
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        // soft-deleted 공연장을 걸러내는 조회 호출
        when(venueRepository.findBySeqAndDeletedAtIsNull(1L)).thenReturn(Optional.of(venue));

        // EventUpdateRequest: Setter가 없는 Jackson 전용 DTO이므로 목으로 대체.
        // (Event도 Mock이라, 전달되는 값 자체는 이 테스트의 관심사가 아님)
        EventUpdateRequest request = mock(EventUpdateRequest.class);
        when(request.getVenueSeq()).thenReturn(1L);
        when(request.getTicketingDate()).thenReturn(LocalDateTime.of(2026, 9, 20, 20, 0));

        service.update(EVENT_ID, request);

        verify(ticketingDateCache).evict(EVENT_ID);
    }

    @Test
    void 이벤트를_삭제하면_오픈시각_캐시를_비운다() {
        Event event = mock(Event.class);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));

        service.delete(EVENT_ID);

        verify(event).softDelete();
        verify(ticketingDateCache).evict(EVENT_ID);
    }
}
