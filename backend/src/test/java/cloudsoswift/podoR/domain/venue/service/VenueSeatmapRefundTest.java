package cloudsoswift.podoR.domain.venue.service;

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
import cloudsoswift.podoR.domain.ticketing.cancel.FailedRefund;
import cloudsoswift.podoR.domain.ticketing.cancel.RefundFailedException;
import cloudsoswift.podoR.domain.ticketing.entity.CancelReason;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.hold.SeatHoldService;
import cloudsoswift.podoR.domain.ticketing.payment.MockPaymentGateway;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest.SeatItem;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.venue.repository.VenueLayoutRepository;
import cloudsoswift.podoR.domain.venue.repository.VenueRepository;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;

/**
 * 공연장 배치 변경 일괄 취소: 주문마다 REQUIRES_NEW 로 "DB 취소 + PG 환불"을 커밋하고,
 * 하나라도 실패하면 좌석맵 저장(바깥 트랜잭션)은 롤백한다.
 * 안쪽 트랜잭션이 실제로 커밋돼야 하므로 @Transactional 테스트로 감싸지 않는다(H2, 실제 MockPaymentGateway 빈).
 */
@SpringBootTest
class VenueSeatmapRefundTest {

    @Autowired VenueSeatmapService service;
    @Autowired MockPaymentGateway gateway;

    @Autowired UserRepository userRepository;
    @Autowired VenueRepository venueRepository;
    @Autowired VenueLayoutRepository venueLayoutRepository;
    @Autowired SeatRepository seatRepository;
    @Autowired EventRepository eventRepository;
    @Autowired EventSeatRepository eventSeatRepository;
    @Autowired TicketingOrderRepository orderRepository;
    @Autowired TicketingItemRepository itemRepository;
    @Autowired PaymentRepository paymentRepository;

    // PaymentConfirmServiceTest 와 같은 목 구성(컨텍스트 캐시 공유)
    @MockitoBean SeatHoldService seatHoldService;
    @MockitoBean WaitingQueueService waitingQueue;
    @MockitoBean SeatVersionGenerator seatVersionGenerator;
    @MockitoBean SeatViewSnapshotCache snapshotCache;

    User user;
    Venue venue;
    Event event;

    @BeforeEach
    void setUp() {
        gateway.reset();
        user = userRepository.save(EntityFixtures.user("vr-user"));
        venue = venueRepository.save(EntityFixtures.venue("vr-venue"));
        save("{\"v\":1}", null, seat("A", 1), seat("A", 2));
        LocalDateTime date = LocalDateTime.now().plusDays(10);
        event = eventRepository.save(Event.builder().host(user).venue(venue).eventId("VR-EVT").seriesId("VR-S")
                .title("공연").eventType("CONCERT").eventDate(date).ticketingDate(date.minusDays(7)).build());
    }

    @AfterEach
    void tearDown() {
        paymentRepository.deleteAllInBatch();
        itemRepository.deleteAllInBatch();
        orderRepository.deleteAllInBatch();
        eventSeatRepository.deleteAllInBatch();
        seatRepository.deleteAllInBatch();
        venueLayoutRepository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
        venueRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    static SeatItem seat(String row, int number) {
        return new SeatItem("A구역", "k1", row, number, true);
    }

    static SeatItem off(String row, int number) {
        return new SeatItem("A구역", "k1", row, number, false);
    }

    void save(String layoutJson, Integer confirmed, SeatItem... seats) {
        service.register(venue.getSeq(), new VenueSeatmapRequest(layoutJson, List.of(seats), confirmed));
    }

    Seat seatAt(String row, int number) {
        return seatRepository.findByVenueSeq(venue.getSeq()).stream()
                .filter(s -> s.getRowNumber().equals(row) && s.getSeatNumber() == number).findFirst().orElseThrow();
    }

    /** 토스로 결제 완료된 주문. 좌석마다 10000원. */
    void book(String orderNo, String paymentKey, Seat... seats) {
        TicketingOrder order = EntityFixtures.order(event, user, orderNo, "PAID");
        for (Seat s : seats) {
            EventSeat es = eventSeatRepository.save(EntityFixtures.eventSeat(event, s, SeatStatus.SOLD, 0L));
            EntityFixtures.item(order, es);
        }
        org.springframework.test.util.ReflectionTestUtils.setField(order, "totalPrice", 10000 * seats.length);
        orderRepository.save(order);
        Payment payment = Payment.builder().ticketingOrder(order).method("카드").amount(10000L * seats.length).build();
        payment.complete(paymentKey, "카드", LocalDateTime.now());
        paymentRepository.save(payment);
    }

    TicketingOrder order(String orderNo) {
        return orderRepository.findDetailByOrderNumber(orderNo).orElseThrow();
    }

    Payment payment(String orderNo) {
        return paymentRepository.findByTicketingOrder_Seq(order(orderNo).getSeq()).orElseThrow();
    }

    String layoutJson() {
        return venueLayoutRepository.findByVenueSeq(venue.getSeq()).orElseThrow().getLayoutJson();
    }

    @Test
    void 두_주문중_하나_환불실패면_성공주문은_취소_실패주문은_그대로_좌석맵은_미반영() {
        book("VR-O1", "pk-1", seatAt("A", 1));
        book("VR-O2", "pk-2", seatAt("A", 2));
        gateway.failCancelFor("pk-2", "PROVIDER_ERROR", "일시적인 오류입니다.");

        assertThatThrownBy(() -> save("{\"v\":2}", 2, off("A", 1), off("A", 2)))
                .isInstanceOfSatisfying(RefundFailedException.class, e -> {
                    assertThat(e.getFailures()).containsExactly(
                            new FailedRefund("VR-O2", "VR-EVT", "PROVIDER_ERROR", "일시적인 오류입니다."));
                    assertThat(e.getMessage()).isEqualTo("환불에 실패한 예매가 있습니다: VR-O2");
                });

        // 성공한 주문: 취소 + 환불이 각자 트랜잭션으로 커밋됐다
        assertThat(order("VR-O1").getStatus()).isEqualTo("CANCELLED");
        assertThat(payment("VR-O1").getStatus()).isEqualTo("CANCELLED");
        assertThat(payment("VR-O1").getCancelledAmount()).isEqualTo(10000L);
        // 실패한 주문: 손대지 않았다(표 유효, 환불 없음)
        TicketingOrder failed = order("VR-O2");
        assertThat(failed.getStatus()).isEqualTo("PAID");
        assertThat(failed.getItems()).singleElement().satisfies(i -> {
            assertThat(i.isActive()).isTrue();
            assertThat(i.getEventSeat()).isNotNull();
        });
        assertThat(payment("VR-O2").getCancelledAmount()).isZero();
        // 좌석맵은 반쪽 반영되지 않는다
        assertThat(seatAt("A", 1).getIsAvailable()).isTrue();
        assertThat(seatAt("A", 2).getIsAvailable()).isTrue();
        assertThat(eventSeatRepository.count()).isEqualTo(2);
        assertThat(layoutJson()).isEqualTo("{\"v\":1}");
        assertThat(gateway.cancelCalls()).extracting(MockPaymentGateway.CancelCall::paymentKey)
                .containsExactlyInAnyOrder("pk-1", "pk-2");
    }

    @Test
    void 다시_저장하면_실패했던_주문만_재시도() {
        book("VR-O1", "pk-1", seatAt("A", 1));
        book("VR-O2", "pk-2", seatAt("A", 2));
        gateway.failCancelFor("pk-2", "PROVIDER_ERROR", "일시적인 오류입니다.");
        assertThatThrownBy(() -> save("{\"v\":2}", 2, off("A", 1), off("A", 2)))
                .isInstanceOf(RefundFailedException.class);
        gateway.reset();

        // 성공한 주문은 더 이상 활성 항목이 아니라 확인 수가 1로 줄어든다
        save("{\"v\":2}", 1, off("A", 1), off("A", 2));

        assertThat(gateway.cancelCalls()).singleElement().satisfies(c -> {
            assertThat(c.paymentKey()).isEqualTo("pk-2");
            assertThat(c.cancelAmount()).isEqualTo(10000L);
            assertThat(c.reason()).isEqualTo("공연장 사정으로 취소");
        });
        assertThat(order("VR-O1").getStatus()).isEqualTo("CANCELLED");
        assertThat(order("VR-O2").getStatus()).isEqualTo("CANCELLED");
        assertThat(payment("VR-O2").getCancelledAmount()).isEqualTo(10000L);
        assertThat(seatAt("A", 1).getIsAvailable()).isFalse();
        assertThat(seatAt("A", 2).getIsAvailable()).isFalse();
        assertThat(eventSeatRepository.count()).isZero();
        assertThat(layoutJson()).isEqualTo("{\"v\":2}");
    }

    /** Review Focus 1: 바깥 트랜잭션의 낡은 항목(PAID)이 연결 끊기 flush 로 덮어쓰지 않는다. */
    @Test
    void 모두_성공하면_항목은_CANCELLED_와_환불액을_유지한다() {
        book("VR-O1", "pk-1", seatAt("A", 1), seatAt("A", 2));

        save("{\"v\":2}", 1, off("A", 1), seat("A", 2));

        TicketingOrder after = order("VR-O1");
        assertThat(after.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        TicketingItem cancelled = after.getItems().stream()
                .filter(i -> i.getSeatNumber() == 1).findFirst().orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(TicketingItem.STATUS_CANCELLED);
        assertThat(cancelled.getCancelReason()).isEqualTo(CancelReason.VENUE_CHANGE);
        assertThat(cancelled.getRefundAmount()).isEqualTo(10000);
        assertThat(cancelled.getCancelledAt()).isNotNull();
        assertThat(cancelled.getEventSeat()).isNull();
        TicketingItem kept = after.getItems().stream()
                .filter(i -> i.getSeatNumber() == 2).findFirst().orElseThrow();
        assertThat(kept.isActive()).isTrue();
        assertThat(kept.getEventSeat()).isNotNull();
        assertThat(payment("VR-O1").getCancelledAmount()).isEqualTo(10000L);
        assertThat(payment("VR-O1").getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(eventSeatRepository.count()).isEqualTo(1);
        assertThat(gateway.cancelCalls()).singleElement()
                .satisfies(c -> assertThat(c.cancelAmount()).isEqualTo(10000L));
        verify(snapshotCache).evict("VR-EVT");
    }

    // ---- VenueSeatmapServiceTest(@DataJpaTest, 테스트 트랜잭션)에서 옮겨 온 취소 적용 케이스 ----
    // REQUIRES_NEW 는 테스트 트랜잭션의 미커밋 데이터를 볼 수 없어 커밋되는 이 테스트에서 검증한다.

    @Test
    void 공연_임박_회차도_배치변경_취소() {
        LocalDateTime soon = LocalDateTime.now().plusMinutes(10);
        event = eventRepository.save(Event.builder().host(user).venue(venue).eventId("VR-SOON").seriesId("VR-S2")
                .title("임박").eventType("CONCERT").eventDate(soon).ticketingDate(soon.minusDays(7)).build());
        book("VR-O1", "pk-1", seatAt("A", 1));

        save("{}", 1, off("A", 1), seat("A", 2));

        TicketingOrder after = order("VR-O1");
        assertThat(after.getStatus()).isEqualTo("CANCELLED");
        assertThat(after.getItems()).singleElement().satisfies(i -> {
            assertThat(i.getCancelReason()).isEqualTo(CancelReason.VENUE_CHANGE);
            assertThat(i.getRefundAmount()).isEqualTo(10000);
        });
        assertThat(payment("VR-O1").getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void 제거된_좌석도_같은_규칙() {
        book("VR-O1", "pk-1", seatAt("A", 1));

        save("{}", 1, seat("A", 2));

        assertThat(order("VR-O1").getStatus()).isEqualTo("CANCELLED");
        assertThat(payment("VR-O1").getStatus()).isEqualTo("CANCELLED");
        assertThat(seatRepository.findByVenueSeq(venue.getSeq())).extracting(Seat::getSeatNumber).containsOnly(2);
        assertThat(eventSeatRepository.count()).isZero();
    }
}
