package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeriesRepository;
import cloudsoswift.podoR.domain.ticketing.dto.HoldResponse;
import cloudsoswift.podoR.domain.ticketing.dto.OrderCreatedResponse;
import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderDetailResponse;
import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderSummaryResponse;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 예매(TicketingOrder) 읽기 측. 추후 예매 생성 등 쓰기 기능을 확장해야 함.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TicketingOrderService {

    private final TicketingOrderRepository ticketingOrderRepository;
    private final EventRepository eventRepository;
    private final EventSeatRepository eventSeatRepository;
    private final EventSeriesRepository eventSeriesRepository;
    private final TicketingItemRepository ticketingItemRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final SeatHoldService seatHoldService;
    private final SeatVersionGenerator seatVersionGenerator;

    private static final int DEFAULT_MAX_SEATS_PER_PERSON = 4;

    public enum DateBasis { BOOKED, WATCHED }

    public List<TicketingOrderSummaryResponse> getMyOrders(Long userSeq, DateBasis basis, int year, int month) {
        LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
        LocalDateTime end = start.plusMonths(1);
        List<TicketingOrder> orders = (basis == DateBasis.WATCHED)
                ? ticketingOrderRepository.findByUserAndEventDateInRange(userSeq, start, end)
                : ticketingOrderRepository.findByUserAndOrderedAtInRange(userSeq, start, end);
        return orders.stream().map(TicketingOrderSummaryResponse::new).toList();
    }

    public TicketingOrderDetailResponse getMyOrder(Long userSeq, String orderNumber) {
        TicketingOrder order = ticketingOrderRepository.findDetailByOrderNumber(orderNumber)
                .filter(o -> o.getUser().getSeq().equals(userSeq))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        return new TicketingOrderDetailResponse(order);
    }

    /** "결제하기": 선택 좌석을 일괄 선점. 충돌/한도초과 시 409. */
    @Transactional(readOnly = true)
    public HoldResponse hold(String eventId, Long userSeq, List<Long> seatSeqs) {
        if (seatSeqs == null || seatSeqs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "no seats");
        }
        Event event = findEvent(eventId);
        enforceLimit(userSeq, event.getSeriesId(), seatSeqs.size());

        List<EventSeat> seats = eventSeatRepository.findAllById(seatSeqs);
        if (seats.size() != seatSeqs.size()
                || seats.stream().anyMatch(s -> !s.getEvent().getSeq().equals(event.getSeq()))
                || seats.stream().anyMatch(s -> s.getStatus() != SeatStatus.AVAILABLE)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "일부 좌석을 예매할 수 없습니다.");
        }
        seatHoldService.releaseAll(userSeq);
        List<Long> conflicts = seatHoldService.tryHoldAll(userSeq, seatSeqs);
        if (!conflicts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 선점된 좌석: " + conflicts);
        }
        return new HoldResponse(seatSeqs, LocalDateTime.now().plusMinutes(5));
    }

    /** 결제창 이탈 시: 이 사용자 선점 전체 해제. */
    @Transactional(readOnly = true)
    public void releaseHolds(Long userSeq) {
        seatHoldService.releaseAll(userSeq);
    }

    /** 결제 확정: hold 재검증 → 좌석 SOLD + 주문/결제 생성. */
    @Transactional
    public OrderCreatedResponse confirmOrder(String eventId, Long userSeq, List<Long> seatSeqs, String method) {
        if (seatSeqs == null || seatSeqs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "no seats");
        }
        Event event = findEvent(eventId);
        if (!seatHoldService.ownsAll(userSeq, seatSeqs)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "선점이 만료되었거나 유효하지 않습니다.");
        }
        enforceLimit(userSeq, event.getSeriesId(), seatSeqs.size());

        List<EventSeat> seats = eventSeatRepository.findAllById(seatSeqs);
        if (seats.size() != seatSeqs.size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "좌석 정보가 유효하지 않습니다.");
        }
        int total = seats.stream().mapToInt(EventSeat::getPrice).sum();

        long version = seatVersionGenerator.next(event.getSeq());
        int affected = eventSeatRepository.updateStatusIfCurrent(
                seatSeqs, event.getSeq(), SeatStatus.AVAILABLE, SeatStatus.SOLD, version);
        if (affected != seatSeqs.size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "좌석이 이미 판매되었습니다.");
        }

        User user = userRepository.findById(userSeq)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
        TicketingOrder order = TicketingOrder.builder()
                .event(event).user(user)
                .orderNumber(generateOrderNumber())
                .totalPrice(total)
                .status("PAID")
                .build();
        for (Long seq : seatSeqs) {
            order.addItem(TicketingItem.builder().eventSeat(eventSeatRepository.getReferenceById(seq)).build());
        }
        ticketingOrderRepository.save(order);
        paymentRepository.save(Payment.builder()
                .ticketingOrder(order).method(method != null ? method : "MOCK").amount((long) total).build());

        seatHoldService.release(userSeq, seatSeqs);
        return new OrderCreatedResponse(order.getOrderNumber());
    }

    /** 주문 전체 취소: 좌석 AVAILABLE + 주문/결제 CANCELLED. */
    @Transactional
    public void cancelOrder(Long userSeq, String orderNumber) {
        TicketingOrder order = ticketingOrderRepository.findDetailByOrderNumber(orderNumber)
                .filter(o -> o.getUser().getSeq().equals(userSeq))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!"PAID".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "취소할 수 없는 주문입니다.");
        }
        List<Long> seatSeqs = order.getItems().stream().map(i -> i.getEventSeat().getSeq()).toList();
        long version = seatVersionGenerator.next(order.getEvent().getSeq());
        eventSeatRepository.updateStatusIfCurrent(seatSeqs, order.getEvent().getSeq(),
                SeatStatus.SOLD, SeatStatus.AVAILABLE, version);
        order.cancel();
        paymentRepository.findByTicketingOrder_Seq(order.getSeq()).ifPresent(Payment::cancel);
    }

    private void enforceLimit(Long userSeq, String seriesId, int requested) {
        int max = eventSeriesRepository.findBySeriesId(seriesId)
                .map(s -> s.getMaxSeatsPerPerson()).orElse(DEFAULT_MAX_SEATS_PER_PERSON);
        long paid = ticketingItemRepository.countPaidSeatsInSeries(userSeq, seriesId);
        if (paid + requested > max) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "이 공연은 1인 최대 " + max + "석까지 예매할 수 있습니다.");
        }
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }

    private String generateOrderNumber() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
