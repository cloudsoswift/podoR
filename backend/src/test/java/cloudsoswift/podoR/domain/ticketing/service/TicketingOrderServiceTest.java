package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.EventSeries;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeriesRepository;
import cloudsoswift.podoR.domain.queue.WaitingQueueService;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.cancel.CancellationNotAllowedException;
import cloudsoswift.podoR.domain.ticketing.cancel.CancellationService;
import cloudsoswift.podoR.domain.ticketing.cancel.DefaultRefundPolicy;
import cloudsoswift.podoR.domain.ticketing.cancel.RefundProperties;
import cloudsoswift.podoR.domain.ticketing.dto.PreparedOrderResponse;
import cloudsoswift.podoR.domain.ticketing.dto.SeatQuotaResponse;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentProperties;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
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
    @Mock WaitingQueueService waitingQueue;
    cloudsoswift.podoR.domain.ticketing.payment.MockPaymentGateway gateway =
            new cloudsoswift.podoR.domain.ticketing.payment.MockPaymentGateway();
    @Spy CancellationService cancellationService = new CancellationService(
            new DefaultRefundPolicy(new RefundProperties(Duration.ofMinutes(30))), gateway);

    @Spy PaymentProperties paymentProperties = new PaymentProperties("mock", Duration.ofMinutes(15), null);

    @InjectMocks TicketingOrderService service;

    static final String EVENT_ID = "EVT1";
    static final String SERIES = "S1";
    static final long USER = 100L;

    private Event mockEvent() {
        Event e = mock(Event.class);
        lenient().when(e.getSeq()).thenReturn(1L);
        lenient().when(e.getSeriesId()).thenReturn(SERIES);
        lenient().when(e.getEventId()).thenReturn(EVENT_ID);
        lenient().when(e.getTitle()).thenReturn("공연");
        lenient().when(e.getEventDate()).thenReturn(LocalDateTime.now().plusDays(7));
        return e;
    }

    private EventSeat mockSeat(long seq, Event event, SeatStatus status, int price) {
        EventSeat s = mock(EventSeat.class);
        lenient().when(s.getSeq()).thenReturn(seq);
        lenient().when(s.getEvent()).thenReturn(event);
        lenient().when(s.getStatus()).thenReturn(status);
        lenient().when(s.getPrice()).thenReturn(price);
        lenient().when(s.getSeatGrade()).thenReturn("VIP");
        lenient().when(s.getSeat()).thenReturn(Seat.builder()
                .section("A구역").sectionKey("A").rowNumber("1").seatNumber((int) seq).build());
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
    void 확정_후처리는_선점해제_캐시evict_그리고_대기열_슬롯반납() {
        List<Long> seats = List.of(1L, 2L);

        service.finishConfirmed(EVENT_ID, USER, SERIES, seats);

        verify(seatHoldService).release(USER, SERIES, seats);
        verify(snapshotCache).evict(EVENT_ID);
        // 볼일이 끝났으니 자리를 즉시 비운다 — TTL 만큼 붙들고 있으면 순환이 느려진다
        verify(waitingQueue).leave(EVENT_ID, USER);
    }

    // ---- 준비(prepare) ----

    private void stubPrepare(Event event, List<Long> seats) {
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(true);
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(0L);
    }

    @Test
    void 준비는_PENDING_주문과_READY_결제를_만들고_금액은_좌석가격합() {
        Event event = mockEvent();
        List<Long> seats = List.of(1L, 2L);
        stubPrepare(event, seats);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.AVAILABLE, 20000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1, s2));
        when(userRepository.findById(USER)).thenReturn(Optional.of(mock(cloudsoswift.podoR.domain.user.entity.User.class)));
        when(ticketingOrderRepository.findPendingByUserAndEvent(USER, 1L)).thenReturn(List.of());

        PreparedOrderResponse r = service.prepareOrder(EVENT_ID, USER, seats);

        org.mockito.ArgumentCaptor<TicketingOrder> oc = org.mockito.ArgumentCaptor.forClass(TicketingOrder.class);
        verify(ticketingOrderRepository).save(oc.capture());
        TicketingOrder saved = oc.getValue();
        assertThat(saved.getStatus()).isEqualTo(TicketingOrder.STATUS_PENDING);
        assertThat(saved.getTotalPrice()).isEqualTo(30000);
        org.mockito.ArgumentCaptor<Payment> pc = org.mockito.ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(pc.capture());
        assertThat(pc.getValue().getStatus()).isEqualTo("READY");
        assertThat(pc.getValue().getAmount()).isEqualTo(30000L);
        assertThat(r.orderNumber()).isEqualTo(saved.getOrderNumber());
        assertThat(r.amount()).isEqualTo(30000);
        assertThat(r.orderName()).isEqualTo("공연 (2석)");
        verify(eventSeatRepository, never()).updateStatusIfCurrent(anyList(), anyLong(), any(), any(), anyLong());
    }

    @Test
    void 준비는_선점을_대기만료시간으로_연장한다() {
        Event event = mockEvent();
        List<Long> seats = List.of(1L);
        stubPrepare(event, seats);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1));
        when(userRepository.findById(USER)).thenReturn(Optional.of(mock(cloudsoswift.podoR.domain.user.entity.User.class)));
        when(ticketingOrderRepository.findPendingByUserAndEvent(USER, 1L)).thenReturn(List.of());

        service.prepareOrder(EVENT_ID, USER, seats);

        verify(seatHoldService).extend(USER, SERIES, seats, Duration.ofMinutes(15));
    }

    private TicketingOrder pendingOrder(Event event, EventSeat... seats) {
        cloudsoswift.podoR.domain.user.entity.User owner = mock(cloudsoswift.podoR.domain.user.entity.User.class);
        return TicketingOrder.pending(event, owner, "OLD-1", List.of(seats));
    }

    @Test
    void 같은_좌석으로_다시_준비하면_기존_주문을_돌려준다() {
        Event event = mockEvent();
        List<Long> seats = List.of(2L, 1L);
        stubPrepare(event, seats);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.AVAILABLE, 20000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s2, s1));
        TicketingOrder existing = pendingOrder(event, s1, s2);
        when(ticketingOrderRepository.findPendingByUserAndEvent(USER, 1L)).thenReturn(List.of(existing));

        PreparedOrderResponse r = service.prepareOrder(EVENT_ID, USER, seats);

        assertThat(r.orderNumber()).isEqualTo("OLD-1");
        assertThat(r.amount()).isEqualTo(30000);
        assertThat(existing.getStatus()).isEqualTo(TicketingOrder.STATUS_PENDING);
        verify(ticketingOrderRepository, never()).save(any());
        verify(paymentRepository, never()).save(any());
        verify(seatHoldService).extend(USER, SERIES, seats, Duration.ofMinutes(15));
    }

    @Test
    void 다른_좌석이면_기존을_REPLACED_로_닫고_새로_만든다() {
        Event event = mockEvent();
        List<Long> seats = List.of(3L);
        stubPrepare(event, seats);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        EventSeat s3 = mockSeat(3L, event, SeatStatus.AVAILABLE, 5000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s3));
        when(userRepository.findById(USER)).thenReturn(Optional.of(mock(cloudsoswift.podoR.domain.user.entity.User.class)));
        TicketingOrder existing = pendingOrder(event, s1);
        Payment oldPayment = Payment.ready(existing, 10000L);
        ReflectionTestUtils.setField(existing, "payment", oldPayment);
        when(ticketingOrderRepository.findPendingByUserAndEvent(USER, 1L)).thenReturn(List.of(existing));

        PreparedOrderResponse r = service.prepareOrder(EVENT_ID, USER, seats);

        assertThat(existing.getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(oldPayment.getStatus()).isEqualTo("FAILED");
        assertThat(oldPayment.getFailCode()).isEqualTo("REPLACED");
        assertThat(oldPayment.getFailMessage()).isEqualTo("다른 좌석으로 다시 주문");
        assertThat(r.orderNumber()).isNotEqualTo("OLD-1");
        assertThat(r.amount()).isEqualTo(5000);
        verify(ticketingOrderRepository).save(any());
    }

    @Test
    void PENDING_이_두개_있어도_준비는_500_없이_하나만_남긴다() {
        Event event = mockEvent();
        List<Long> seats = List.of(1L);
        stubPrepare(event, seats);
        EventSeat s1 = mockSeat(1L, event, SeatStatus.AVAILABLE, 10000);
        when(eventSeatRepository.findAllById(seats)).thenReturn(List.of(s1));
        cloudsoswift.podoR.domain.user.entity.User owner = mock(cloudsoswift.podoR.domain.user.entity.User.class);
        TicketingOrder newest = TicketingOrder.pending(event, owner, "NEW-1", List.of(s1));
        TicketingOrder older = TicketingOrder.pending(event, owner, "OLD-1", List.of(s1));
        Payment olderPayment = Payment.ready(older, 10000L);
        ReflectionTestUtils.setField(older, "payment", olderPayment);
        when(ticketingOrderRepository.findPendingByUserAndEvent(USER, 1L)).thenReturn(List.of(newest, older));

        PreparedOrderResponse r = service.prepareOrder(EVENT_ID, USER, seats);

        assertThat(r.orderNumber()).isEqualTo("NEW-1");
        assertThat(newest.getStatus()).isEqualTo(TicketingOrder.STATUS_PENDING);
        assertThat(older.getStatus()).isEqualTo(TicketingOrder.STATUS_FAILED);
        assertThat(olderPayment.getFailCode()).isEqualTo("REPLACED");
        verify(ticketingOrderRepository, never()).save(any());
    }

    @Test
    void 선점이_없으면_409() {
        Event event = mockEvent();
        List<Long> seats = List.of(1L);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(false);

        assertThatThrownBy(() -> service.prepareOrder(EVENT_ID, USER, seats))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        verify(ticketingOrderRepository, never()).save(any());
    }

    @Test
    void 준비_빈_좌석목록은_400() {
        assertThatThrownBy(() -> service.prepareOrder(EVENT_ID, USER, List.of()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
    }

    @Test
    void 준비_한도초과면_409() {
        Event event = mockEvent();
        List<Long> seats = List.of(1L, 2L);
        when(eventRepository.findByEventIdAndDeletedDateIsNull(EVENT_ID)).thenReturn(Optional.of(event));
        when(seatHoldService.ownsAll(USER, seats)).thenReturn(true);
        stubSeries(4);
        when(ticketingItemRepository.countPaidSeatsInSeries(USER, SERIES)).thenReturn(3L);

        assertThatThrownBy(() -> service.prepareOrder(EVENT_ID, USER, seats))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("최대");
        verify(ticketingOrderRepository, never()).save(any());
    }

    @Test
    void getMyOrder_PENDING_주문은_404() {
        Event event = mockEvent();
        TicketingOrder order = paidOrder(event, paidItem(11L, mockSeat(1L, event, SeatStatus.SOLD, 10000), 10000));
        ReflectionTestUtils.setField(order, "status", TicketingOrder.STATUS_PENDING);

        assertThatThrownBy(() -> service.getMyOrder(USER, "O1"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    // ---- 부분 취소 ----

    private TicketingItem paidItem(long itemSeq, EventSeat es, int price) {
        TicketingItem item = TicketingItem.builder().eventSeat(es)
                .section("A구역").rowNumber("A").seatNumber((int) itemSeq).seatGrade("VIP").price(price).build();
        ReflectionTestUtils.setField(item, "seq", itemSeq);
        return item;
    }

    private TicketingOrder paidOrder(Event event, TicketingItem... items) {
        cloudsoswift.podoR.domain.user.entity.User owner = mock(cloudsoswift.podoR.domain.user.entity.User.class);
        lenient().when(owner.getSeq()).thenReturn(USER);
        int total = 0;
        for (TicketingItem i : items) total += i.getPrice();
        TicketingOrder order = TicketingOrder.builder().event(event).user(owner)
                .orderNumber("O1").totalPrice(total).status("PAID").build();
        for (TicketingItem i : items) order.addItem(i);
        when(ticketingOrderRepository.findDetailByOrderNumber("O1")).thenReturn(Optional.of(order));
        return order;
    }

    @Test
    void cancelItems_선택_항목만_취소하고_좌석을_AVAILABLE로() {
        Event event = mockEvent();
        EventSeat s1 = mockSeat(1L, event, SeatStatus.SOLD, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.SOLD, 20000);
        TicketingOrder order = paidOrder(event, paidItem(11L, s1, 10000), paidItem(12L, s2, 20000));
        Payment payment = Payment.builder().ticketingOrder(order).amount(30000L).method("MOCK").build();
        ReflectionTestUtils.setField(order, "payment", payment);
        when(seatVersionGenerator.next(1L)).thenReturn(7L);

        service.cancelItems(USER, "O1", List.of(12L));

        verify(eventSeatRepository).updateStatusIfCurrent(List.of(2L), 1L, SeatStatus.SOLD, SeatStatus.AVAILABLE, 7L);
        assertThat(order.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(order.getTotalPrice()).isEqualTo(10000);
        assertThat(payment.getCancelledAmount()).isEqualTo(20000L);
        assertThat(payment.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        verify(snapshotCache).evict(EVENT_ID);
    }

    @Test
    void cancelItems_PARTIALLY_CANCELLED_주문도_추가_취소_가능() {
        Event event = mockEvent();
        EventSeat s1 = mockSeat(1L, event, SeatStatus.SOLD, 10000);
        EventSeat s2 = mockSeat(2L, event, SeatStatus.SOLD, 20000);
        TicketingOrder order = paidOrder(event, paidItem(11L, s1, 10000), paidItem(12L, s2, 20000));
        when(seatVersionGenerator.next(1L)).thenReturn(7L, 8L);

        service.cancelItems(USER, "O1", List.of(11L));
        service.cancelItems(USER, "O1", List.of(12L));

        assertThat(order.getStatus()).isEqualTo("CANCELLED");
        assertThat(order.getTotalPrice()).isZero();
    }

    @Test
    void cancelItems_빈목록이나_남의_주문이면_실패() {
        Event event = mockEvent();
        paidOrder(event, paidItem(11L, mockSeat(1L, event, SeatStatus.SOLD, 10000), 10000));

        assertThatThrownBy(() -> service.cancelItems(USER, "O1", List.of()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        assertThatThrownBy(() -> service.cancelItems(999L, "O1", List.of(11L)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        assertThatThrownBy(() -> service.cancelItems(USER, "O1", List.of(99L)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
    }

    @Test
    void cancelOrder_연결이_끊긴_항목은_좌석복구에서_제외() {
        Event event = mockEvent();
        EventSeat s1 = mockSeat(1L, event, SeatStatus.SOLD, 10000);
        TicketingItem detached = paidItem(12L, mockSeat(2L, event, SeatStatus.SOLD, 20000), 20000);
        detached.detachEventSeat();
        TicketingOrder order = paidOrder(event, paidItem(11L, s1, 10000), detached);
        when(seatVersionGenerator.next(1L)).thenReturn(7L);

        service.cancelOrder(USER, "O1");

        verify(eventSeatRepository).updateStatusIfCurrent(List.of(1L), 1L, SeatStatus.SOLD, SeatStatus.AVAILABLE, 7L);
        assertThat(order.getStatus()).isEqualTo("CANCELLED");
    }
    /** 토스 결제(paymentKey 있음) 주문 하나: 좌석 1석 10000원. */
    private TicketingOrder tossPaidOrder() {
        Event event = mockEvent();
        TicketingOrder order = paidOrder(event, paidItem(11L, mockSeat(1L, event, SeatStatus.SOLD, 10000), 10000));
        Payment payment = Payment.builder().ticketingOrder(order).amount(10000L).method("카드").build();
        payment.complete("pk-1", "카드", LocalDateTime.now());
        ReflectionTestUtils.setField(order, "payment", payment);
        return order;
    }

    @Test
    void 환불_후_캐시_삭제는_커밋_뒤에_하고_실패해도_취소는_성공한다() {
        TicketingOrder order = tossPaidOrder();
        when(seatVersionGenerator.next(1L)).thenReturn(7L);
        doThrow(new RuntimeException("redis down")).when(snapshotCache).evict(anyString());
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.cancelItems(USER, "O1", List.of(11L));

            // 커밋 전에는 캐시를 건드리지 않는다
            verify(snapshotCache, never()).evict(anyString());
            assertThat(gateway.cancelCalls()).hasSize(1);
            // 커밋 후 콜백: 캐시 삭제가 실패해도 예외가 새지 않는다
            org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
        verify(snapshotCache).evict(EVENT_ID);
        assertThat(order.getStatus()).isEqualTo("CANCELLED");
        assertThat(order.getItems()).allSatisfy(i -> assertThat(i.isActive()).isFalse());
    }

    @Test
    void 좌석_버전_발급이_실패하면_환불하지_않는다() {
        tossPaidOrder();
        when(seatVersionGenerator.next(1L)).thenThrow(new RuntimeException("redis down"));

        assertThatThrownBy(() -> service.cancelItems(USER, "O1", List.of(11L)))
                .hasMessage("redis down");

        assertThat(gateway.cancelCalls()).isEmpty();
        verify(eventSeatRepository, never()).updateStatusIfCurrent(anyList(), anyLong(), any(), any(), anyLong());
    }

    @Test
    void 좌석_되돌리기는_PG_환불보다_먼저() {
        tossPaidOrder();
        when(seatVersionGenerator.next(1L)).thenAnswer(inv -> {
            assertThat(gateway.cancelCalls()).isEmpty();
            return 7L;
        });

        service.cancelItems(USER, "O1", List.of(11L));

        verify(eventSeatRepository).updateStatusIfCurrent(List.of(1L), 1L, SeatStatus.SOLD, SeatStatus.AVAILABLE, 7L);
        assertThat(gateway.cancelCalls()).singleElement()
                .satisfies(c -> assertThat(c.cancelAmount()).isEqualTo(10000L));
    }

    @Test
    void 마감_후_취소는_거절하고_아무것도_바꾸지_않는다() {
        Event event = mockEvent();
        when(event.getEventDate()).thenReturn(LocalDateTime.now().plusMinutes(10));
        TicketingOrder order = paidOrder(event, paidItem(11L, mockSeat(1L, event, SeatStatus.SOLD, 10000), 10000));

        assertThatThrownBy(() -> service.cancelItems(USER, "O1", List.of(11L)))
                .isInstanceOf(CancellationNotAllowedException.class);

        assertThat(order.getStatus()).isEqualTo("PAID");
        verify(eventSeatRepository, never()).updateStatusIfCurrent(anyList(), anyLong(), any(), any(), anyLong());
        verify(snapshotCache, never()).evict(anyString());
    }
    @Test
    void getMyOrder_취소_마감을_담는다() {
        Event event = mockEvent();
        LocalDateTime show = LocalDateTime.of(2026, 12, 1, 19, 0);
        when(event.getEventDate()).thenReturn(show);
        when(event.getVenue()).thenReturn(cloudsoswift.podoR.domain.venue.entity.Venue.builder().name("v").address("a").build());
        paidOrder(event, paidItem(11L, mockSeat(1L, event, SeatStatus.SOLD, 10000), 10000));

        assertThat(service.getMyOrder(USER, "O1").getCancellableUntil()).isEqualTo(show.minusMinutes(30));
    }
}
