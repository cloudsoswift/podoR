package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.common.seat.SeatVersionGenerator;
import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.queue.WaitingQueueService;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 스케줄러 경로가 테스트 트랜잭션 없이도(프록시를 거쳐) 동작하는지 확인한다. */
@SpringBootTest
class PendingOrderExpirySchedulerTest {

    @Autowired PendingOrderExpiryScheduler scheduler;
    @Autowired UserRepository userRepository;
    @Autowired VenueRepository venueRepository;
    @Autowired SeatRepository seatRepository;
    @Autowired EventRepository eventRepository;
    @Autowired EventSeatRepository eventSeatRepository;
    @Autowired TicketingOrderRepository orderRepository;
    @Autowired TicketingItemRepository itemRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired JdbcTemplate jdbc;

    @MockitoBean SeatHoldService seatHoldService;
    @MockitoBean WaitingQueueService waitingQueue;
    @MockitoBean SeatVersionGenerator seatVersionGenerator;
    @MockitoBean SeatViewSnapshotCache snapshotCache;

    @AfterEach
    void tearDown() {
        paymentRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        orderRepository.deleteAllInBatch();
        eventSeatRepository.deleteAllInBatch();
        seatRepository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
        venueRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    @Test
    void 스케줄러_run_은_트랜잭션_없이도_방치_주문_항목_결제를_EXPIRED_로_만든다() {
        User user = userRepository.save(EntityFixtures.user("sch-user"));
        Venue venue = venueRepository.save(EntityFixtures.venue("sch-venue"));
        Event event = eventRepository.save(EntityFixtures.event(user, venue, "SCH-EVT", "SCH-SERIES"));
        Seat seat = seatRepository.save(EntityFixtures.seat(venue, "A", "1", 1));
        EventSeat es = eventSeatRepository.save(EntityFixtures.eventSeat(event, seat, SeatStatus.AVAILABLE, 0L));
        TicketingOrder order = orderRepository.save(TicketingOrder.pending(event, user, "SCH-1", List.of(es)));
        paymentRepository.save(Payment.ready(order, order.getTotalPrice()));
        jdbc.update("UPDATE ticketing_order SET ordered_at = ? WHERE seq = ?",
                Timestamp.valueOf(LocalDateTime.now().minusMinutes(30)), order.getSeq());

        scheduler.run();

        TicketingOrder found = orderRepository.findDetailByOrderNumber("SCH-1").orElseThrow();
        assertThat(found.getStatus()).isEqualTo("EXPIRED");
        assertThat(found.getItems()).extracting(i -> i.getStatus()).containsOnly("EXPIRED");
        assertThat(paymentRepository.findByTicketingOrder_Seq(order.getSeq()).orElseThrow().getStatus())
                .isEqualTo("EXPIRED");
    }
}
