package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.EventSeries;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeriesRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.dto.SeatQuotaResponse;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketingOrderServiceTest {

    @Mock TicketingOrderRepository ticketingOrderRepository;
    @Mock EventRepository eventRepository;
    @Mock EventSeatRepository eventSeatRepository;
    @Mock EventSeriesRepository eventSeriesRepository;
    @Mock TicketingItemRepository ticketingItemRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock UserRepository userRepository;
    @Mock SeatHoldService seatHoldService;
    @Mock SeatVersionGenerator seatVersionGenerator;
    @Mock SeatViewSnapshotCache snapshotCache;

    @InjectMocks TicketingOrderService service;

    static final String EVENT_ID = "EVT1";
    static final String SERIES = "S1";
    static final long USER = 100L;

    private Event mockEvent() {
        Event e = mock(Event.class);
        lenient().when(e.getSeq()).thenReturn(1L);
        lenient().when(e.getSeriesId()).thenReturn(SERIES);
        lenient().when(e.getEventId()).thenReturn(EVENT_ID);
        return e;
    }

    private EventSeat mockSeat(long seq, Event event, SeatStatus status, int price) {
        EventSeat s = mock(EventSeat.class);
        lenient().when(s.getSeq()).thenReturn(seq);
        lenient().when(s.getEvent()).thenReturn(event);
        lenient().when(s.getStatus()).thenReturn(status);
        lenient().when(s.getPrice()).thenReturn(price);
        return s;
    }

    private void stubSeries(int max) {
        EventSeries series = mock(EventSeries.class);
        lenient().when(series.getMaxSeatsPerPerson()).thenReturn(max);
        when(eventSeriesRepository.findBySeriesId(SERIES)).thenReturn(Optional.of(series));
    }

    @Test
    void hold_한도초과면_409() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L, 2L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1, s2));
        when(seatHoldService.ownedAmong(USER, SERIES, seats)).thenReturn(List.of());
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(3L);
        when(seatHoldService.heldCountInSeries(USER, SERIES)).thenReturn(0);

        assertThatThrownBy(() -> service.hold(EVENT_ID, USER, seats))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최대");
        verify(seatHoldService, never()).tryHoldAll(anyLong(), anyString(), anyList());
    }

    @Test
    void hold_본인이_이미잡은좌석은_중복집계에서_제외되어_통과() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L, 2L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1, s2));
        // 두 좌석 모두 이미 본인 소유 → requestedNew = 0
        when(seatHoldService.ownedAmong(USER, SERIES, seats)).thenReturn(List.of(1L, 2L));
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(2L);
        when(seatHoldService.heldCountInSeries(USER, SERIES)).thenReturn(2);
        when(seatHoldService.tryHoldAll(USER, SERIES, seats)).thenReturn(List.of());

        assertThat(service.hold(EVENT_ID, USER, seats).getHeldSeats()).isEqualTo(seats);
        verify(seatHoldService).tryHoldAll(USER, SERIES, seats);
    }

    @Test
    void hold_좌석중_SOLD가_있으면_409_그리고_tryHoldAll_미호출() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L, 2L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.SOLD, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1, s2));

        assertThatThrownBy(() -> service.hold(EVENT_ID, USER, seats))
                .isInstanceOf(ResponseStatusException.class);
        verify(seatHoldService, never()).tryHoldAll(anyLong(), anyString(), anyList());
    }

    @Test
    void hold_선점충돌이면_409() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1));
        when(seatHoldService.ownedAmong(USER, SERIES, seats)).thenReturn(List.of());
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(0L);
        when(seatHoldService.heldCountInSeries(USER, SERIES)).thenReturn(0);
        when(seatHoldService.tryHoldAll(USER, SERIES, seats)).thenReturn(List.of(1L)); // 충돌

        assertThatThrownBy(() -> service.hold(EVENT_ID, USER, seats))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("이미 선점");
    }

    @Test
    void getMyQuota_used는_paid더하기held_max반영() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(2L);
        when(seatHoldService.heldCountInSeries(USER, SERIES)).thenReturn(1);

        SeatQuotaResponse q = service.getMyQuota(EVENT_ID, USER);

        assertThat(q.getUsed()).isEqualTo(3L);
        assertThat(q.getMax()).isEqualTo(4);
    }

    @Test
    void getMyQuota_시리즈_maxSeatsPerPerson_null이면_기본4() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        EventSeries series = mock(EventSeries.class);
        when(series.getMaxSeatsPerPerson()).thenReturn(null);
        when(eventSeriesRepository.findBySeriesId(SERIES)).thenReturn(Optional.of(series));
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(0L);
        when(seatHoldService.heldCountInSeries(USER, SERIES)).thenReturn(0);

        assertThat(service.getMyQuota(EVENT_ID, USER).getMax()).isEqualTo(4);
    }

    @Test
    void confirmOrder_성공시_좌석SOLD전이_release_그리고_캐시evict() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L, 2L);
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(true);
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(0L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.AVAILABLE, 20000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1, s2));
        when(seatVersionGenerator.next(1L)).thenReturn(5L);
        when(eventSeatRepository.updateStatusIfCurrent(seats, 1L,
                SeatStatus.AVAILABLE, SeatStatus.SOLD, 5L)).thenReturn(2); // affected == size
        when(userRepository.findById(USER)).thenReturn(Optional.of(mock(cloudsoswift.podoR.domain.user.entity.User.class)));
        when(eventSeatRepository.getReferenceById(anyLong())).thenReturn(mock(EventSeat.class));

        service.confirmOrder(EVENT_ID, USER, seats, "MOCK");

        verify(ticketingOrderRepository).save(any());
        verify(paymentRepository).save(any());
        verify(seatHoldService).release(USER, SERIES, seats);
        verify(snapshotCache).evict(EVENT_ID);
    }

    @Test
    void confirmOrder_좌석이_이미판매되면_409_그리고_저장_evict_미발생() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L);
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(true);
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(0L);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1));
        when(seatVersionGenerator.next(1L)).thenReturn(5L);
        when(eventSeatRepository.updateStatusIfCurrent(seats, 1L,
                SeatStatus.AVAILABLE, SeatStatus.SOLD, 5L)).thenReturn(0); // affected != size

        assertThatThrownBy(() -> service.confirmOrder(EVENT_ID, USER, seats, "MOCK"))
                .isInstanceOf(ResponseStatusException.class);
        verify(ticketingOrderRepository, never()).save(any());
        verify(snapshotCache, never()).evict(anyString());
    }

    @Test
    void confirmOrder_선점만료면_409() {
        Event event = mockEvent();
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        List<Long> seats = List.of(1L);
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(false);

        assertThatThrownBy(() -> service.confirmOrder(EVENT_ID, USER, seats, "MOCK"))
                .isInstanceOf(ResponseStatusException.class);
        verify(eventSeatRepository, never()).updateStatusIfCurrent(anyList(), anyLong(), any(), any(), anyLong());
    }
}
