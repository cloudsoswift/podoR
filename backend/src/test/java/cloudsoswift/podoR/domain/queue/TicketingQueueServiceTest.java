package cloudsoswift.podoR.domain.queue;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.queue.dto.QueueStatusResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketingQueueServiceTest {

    @Mock EventRepository eventRepository;
    @Mock WaitingQueueService waitingQueue;

    @InjectMocks TicketingQueueService service;

    static final String EVENT_ID = "EVT1";
    static final long USER = 100L;

    /**
     * 주의: 반환값을 반드시 지역 변수에 먼저 담고 나서 when(...) 에 넣어야 한다.
     * thenReturn() 인자 안에서 호출하면 내부 when() 이 바깥 스터빙 도중에 실행되어
     * UnfinishedStubbingException 이 난다.
     */
    private Event mockEvent(LocalDateTime ticketingDate) {
        Event e = mock(Event.class);
        lenient().when(e.getTicketingDate()).thenReturn(ticketingDate);
        return e;
    }

    @Test
    void 오픈_전이면_NOT_OPEN_과_opensAt_만_주고_Redis_를_건드리지_않는다() {
        LocalDateTime opensAt = LocalDateTime.now().plusHours(3);
        Event event = mockEvent(opensAt);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));

        QueueStatusResponse r = service.enterOrPoll(EVENT_ID, USER);

        assertThat(r.status()).isEqualTo(QueueStatus.NOT_OPEN);
        assertThat(r.opensAt()).isEqualTo(opensAt);
        assertThat(r.position()).isNull();
        assertThat(r.ahead()).isNull();
        assertThat(r.passExpiresAt()).isNull();
        // 오픈 전에는 순번조차 발급되지 않아야 한다
        verify(waitingQueue, never()).enterOrPoll(anyString(), anyLong());
    }

    @Test
    void 오픈_이후_대기중이면_position_은_ahead_에_1을_더한_값이다() {
        LocalDateTime opensAt = LocalDateTime.now().minusMinutes(1);
        Event event = mockEvent(opensAt);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        when(waitingQueue.enterOrPoll(EVENT_ID, USER))
                .thenReturn(new QueueSnapshot(QueueStatus.WAITING, 41L, null));

        QueueStatusResponse r = service.enterOrPoll(EVENT_ID, USER);

        assertThat(r.status()).isEqualTo(QueueStatus.WAITING);
        assertThat(r.ahead()).isEqualTo(41L);
        assertThat(r.position()).isEqualTo(42L);
        assertThat(r.passExpiresAt()).isNull();
        assertThat(r.opensAt()).isEqualTo(opensAt);
    }

    @Test
    void 오픈_이후_입장했으면_passExpiresAt_을_그대로_전달한다() {
        LocalDateTime opensAt = LocalDateTime.now().minusMinutes(1);
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(15);
        Event event = mockEvent(opensAt);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        when(waitingQueue.enterOrPoll(EVENT_ID, USER))
                .thenReturn(new QueueSnapshot(QueueStatus.ADMITTED, 0L, expiresAt));

        QueueStatusResponse r = service.enterOrPoll(EVENT_ID, USER);

        assertThat(r.status()).isEqualTo(QueueStatus.ADMITTED);
        assertThat(r.passExpiresAt()).isEqualTo(expiresAt);
        assertThat(r.position()).isNull();
        assertThat(r.ahead()).isNull();
    }

    @Test
    void 없는_이벤트면_404() {
        when(eventRepository.findByEventIdAndDeletedDateIsNull("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.enterOrPoll("NOPE", USER))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
        verifyNoInteractions(waitingQueue);
    }

    @Test
    void leave_는_이벤트_확인_후_큐에_위임한다() {
        Event event = mockEvent(LocalDateTime.now().minusMinutes(1));
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));

        service.leave(EVENT_ID, USER);

        verify(waitingQueue).leave(EVENT_ID, USER);
    }

    @Test
    void leave_도_없는_이벤트면_404() {
        when(eventRepository.findByEventIdAndDeletedDateIsNull("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.leave("NOPE", USER))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(waitingQueue);
    }
}
