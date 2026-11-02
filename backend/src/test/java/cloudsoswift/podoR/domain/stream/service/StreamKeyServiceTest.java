package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.dto.StreamKeyResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StreamKeyServiceTest {

    EventRepository eventRepository = mock(EventRepository.class);
    StreamProperties props = new StreamProperties("rtmp://host/live", 1, Duration.ofMinutes(3), "t", "s", "/media");
    StreamKeyService service = new StreamKeyService(eventRepository, props);

    Event event;

    @BeforeEach
    void setUp() {
        event = event(StreamStatus.SCHEDULED);
        when(eventRepository.findByEventIdAndDeletedDateIsNull("E1")).thenReturn(Optional.of(event));
    }

    private static Event event(StreamStatus status) {
        LocalDateTime now = LocalDateTime.now();
        return Event.builder().eventId("E1").seriesId("S").title("t").eventType("C")
                .eventDate(now).ticketingDate(now).streamStatus(status).build();
    }

    @Test
    void 처음_요청하면_43자_URL_safe_키를_발급하고_다시_요청하면_같은_키() {
        StreamKeyResponse first = service.getOrIssue("E1");
        StreamKeyResponse second = service.getOrIssue("E1");

        assertThat(first.streamKey()).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(second.streamKey()).isEqualTo(first.streamKey());
        assertThat(first.rtmpUrl()).isEqualTo("rtmp://host/live");
        assertThat(first.status()).isEqualTo("SCHEDULED");
    }

    @Test
    void 재발급하면_키가_바뀐다() {
        String before = service.getOrIssue("E1").streamKey();

        String after = service.reissue("E1").streamKey();

        assertThat(after).isNotEqualTo(before).hasSize(43);
    }

    @Test
    void LIVE_중_재발급은_409() {
        Event live = event(StreamStatus.LIVE);
        when(eventRepository.findByEventIdAndDeletedDateIsNull("E2")).thenReturn(Optional.of(live));

        assertThatThrownBy(() -> service.reissue("E2"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }
}
