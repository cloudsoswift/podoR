package cloudsoswift.podoR.domain.venue.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.seat.repository.SeatRepository;
import cloudsoswift.podoR.domain.seatview.cache.SeatViewSnapshotCache;
import cloudsoswift.podoR.domain.ticketing.entity.Payment;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.dto.SeatmapCancelPreview;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest;
import cloudsoswift.podoR.domain.venue.dto.VenueSeatmapRequest.SeatItem;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(VenueSeatmapService.class)
class VenueSeatmapServiceTest {

    @Autowired TestEntityManager em;
    @Autowired VenueSeatmapService service;
    @Autowired SeatRepository seatRepository;
    @MockitoBean SeatViewSnapshotCache snapshotCache;

    User user;
    Venue venue;

    @BeforeEach
    void base() {
        user = em.persist(EntityFixtures.user("u1"));
        venue = em.persist(EntityFixtures.venue("v"));
    }

    static SeatItem seat(String name, String key, String row, int number) {
        return new SeatItem(name, key, row, number, true);
    }

    static SeatItem off(String name, String key, String row, int number) {
        return new SeatItem(name, key, row, number, false);
    }

    void save(SeatItem... seats) {
        save(null, seats);
    }

    void save(Integer confirmed, SeatItem... seats) {
        service.register(venue.getSeq(), new VenueSeatmapRequest("{}", List.of(seats), confirmed));
        em.flush();
        em.clear();
    }

    /** "row-number" → seq */
    Map<String, Long> seqs() {
        return seatRepository.findByVenueSeq(venue.getSeq()).stream()
                .collect(Collectors.toMap(s -> s.getRowNumber() + "-" + s.getSeatNumber(), Seat::getSeq));
    }

    List<Seat> seats() {
        return seatRepository.findByVenueSeq(venue.getSeq()).stream()
                .sorted(Comparator.comparing(Seat::getRowNumber).thenComparing(Seat::getSeatNumber)).toList();
    }

    @Test
    void 같은_키_좌석은_seq를_유지() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2), seat("A구역", "k1", "B", 1));
        Map<String, Long> before = seqs();

        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2), seat("A구역", "k1", "B", 1));

        assertThat(seqs()).isEqualTo(before);
    }

    @Test
    void 섹션_이름만_바꾸면_seq_유지_section_갱신() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Map<String, Long> before = seqs();

        save(seat("VIP석", "k1", "A", 1), seat("VIP석", "k1", "A", 2));

        assertThat(seqs()).isEqualTo(before);
        assertThat(seats()).extracting(Seat::getSection).containsOnly("VIP석");
    }

    @Test
    void 추가와_제거() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Long a2 = seqs().get("A-2");

        save(seat("A구역", "k1", "A", 2), seat("A구역", "k1", "A", 3));

        assertThat(seqs()).containsOnlyKeys("A-2", "A-3").containsEntry("A-2", a2);
    }

    @Test
    void 사용안함_전환은_좌석을_남기고_isAvailable만_바꾼다() {
        save(seat("A구역", "k1", "A", 1));
        Long a1 = seqs().get("A-1");

        save(off("A구역", "k1", "A", 1));

        assertThat(seats()).singleElement().satisfies(s -> {
            assertThat(s.getSeq()).isEqualTo(a1);
            assertThat(s.getIsAvailable()).isFalse();
        });
    }

    @Test
    void section_key가_없는_기존_좌석은_섹션_이름으로_키를_채운다() {
        Seat legacy = em.persist(Seat.builder().venue(venue).section("A구역").rowNumber("A").seatNumber(1).build());
        em.persist(Seat.builder().venue(venue).section("없어진구역").rowNumber("A").seatNumber(1).build());
        em.flush();
        em.clear();

        save(seat("A구역", "k1", "A", 1), seat("B구역", "k2", "A", 1));

        List<Seat> after = seats();
        assertThat(after).extracting(Seat::getSectionKey).containsExactlyInAnyOrder("k1", "k2");
        assertThat(after).filteredOn(s -> "k1".equals(s.getSectionKey()))
                .singleElement().extracting(Seat::getSeq).isEqualTo(legacy.getSeq());
        assertThat(after).extracting(Seat::getSection).doesNotContain("없어진구역");
    }

    @Test
    void 회차좌석이_있어도_변경이_없으면_저장_성공() {
        save(seat("A구역", "k1", "A", 1));
        Seat s = seatRepository.findByVenueSeq(venue.getSeq()).get(0);
        Event e = em.persist(EntityFixtures.event(user, venue, "E1", "S1"));
        em.persist(EntityFixtures.eventSeat(e, s, SeatStatus.AVAILABLE, 0L));
        em.flush();
        em.clear();

        save(seat("A구역", "k1", "A", 1));

        assertThat(seqs()).containsEntry("A-1", s.getSeq());
    }

    // ---- 사라지거나 사용 안 함이 된 좌석의 예매 정리 ----

    Event eventAt(String eventId, LocalDateTime date) {
        return em.persist(Event.builder().host(user).venue(venue).eventId(eventId).seriesId("S-" + eventId)
                .title("공연 " + eventId).eventType("CONCERT").eventDate(date).ticketingDate(date.minusDays(7)).build());
    }

    Seat seatAt(String row, int number) {
        return seatRepository.findByVenueSeq(venue.getSeq()).stream()
                .filter(s -> s.getRowNumber().equals(row) && s.getSeatNumber() == number).findFirst().orElseThrow();
    }

    /** 회차 e 에 좌석들로 결제 완료 주문 하나. 좌석마다 10000원. */
    TicketingOrder book(Event e, String orderNo, Seat... seats) {
        TicketingOrder order = em.persist(EntityFixtures.order(e, user, orderNo, "PAID"));
        for (Seat s : seats) {
            EventSeat es = em.persist(EntityFixtures.eventSeat(e, s, SeatStatus.SOLD, 0L));
            em.persist(EntityFixtures.item(order, es));
        }
        ReflectionTestUtils.setField(order, "totalPrice", 10000 * seats.length);
        em.persist(Payment.builder().ticketingOrder(order).method("MOCK").amount(10000L * seats.length).build());
        em.flush();
        em.clear();
        return order;
    }

    TicketingOrder reload(TicketingOrder o) {
        return em.find(TicketingOrder.class, o.getSeq());
    }

    long eventSeatCount() {
        return em.getEntityManager().createQuery("SELECT COUNT(es) FROM EventSeat es", Long.class).getSingleResult();
    }

    @Test
    void 예매된_좌석을_사용안함으로_바꾸면_확인수_없이_409_변경없음() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        TicketingOrder order = book(e, "O1", seatAt("A", 1));

        assertThatThrownBy(() -> service.register(venue.getSeq(), new VenueSeatmapRequest(
                "{}", List.of(off("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2)), null)))
                .isInstanceOfSatisfying(SeatmapCancelConfirmRequiredException.class, ex -> {
                    SeatmapCancelPreview p = ex.getPreview();
                    assertThat(p.getCode()).isEqualTo("SEATMAP_CANCEL_CONFIRM_REQUIRED");
                    assertThat(p.getCancelSeatCount()).isEqualTo(1);
                    assertThat(p.getCancelOrderCount()).isEqualTo(1);
                    assertThat(p.getEvents()).singleElement().satisfies(ev -> {
                        assertThat(ev.getEventId()).isEqualTo("E1");
                        assertThat(ev.getTitle()).isEqualTo("공연 E1");
                        assertThat(ev.getSeatCount()).isEqualTo(1);
                    });
                });
        em.clear();
        assertThat(seatAt("A", 1).getIsAvailable()).isTrue();
        assertThat(reload(order).getStatus()).isEqualTo("PAID");
        assertThat(eventSeatCount()).isEqualTo(1);
    }

    @Test
    void 확인수가_맞으면_그_좌석만_부분취소() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        TicketingOrder order = book(e, "O1", seatAt("A", 1), seatAt("A", 2));

        save(1, off("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));

        TicketingOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo("PARTIALLY_CANCELLED");
        assertThat(after.getTotalPrice()).isEqualTo(10000);
        assertThat(after.getPayment().getCancelledAmount()).isEqualTo(10000L);
        TicketingItem cancelled = after.getItems().stream().filter(i -> !i.isActive()).findFirst().orElseThrow();
        assertThat(cancelled.getEventSeat()).isNull();
        assertThat(cancelled.getRowNumber()).isEqualTo("A");
        assertThat(cancelled.getSeatNumber()).isEqualTo(1);
        assertThat(after.activeItems()).singleElement().satisfies(i -> assertThat(i.getEventSeat()).isNotNull());
        assertThat(eventSeatCount()).isEqualTo(1);
        assertThat(seatAt("A", 1).getIsAvailable()).isFalse();
        verify(snapshotCache).evict("E1");
    }

    @Test
    void 확인수가_다르면_409() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        book(e, "O1", seatAt("A", 1));
        book(e, "O2", seatAt("A", 2));

        assertThatThrownBy(() -> service.register(venue.getSeq(), new VenueSeatmapRequest(
                "{}", List.of(off("A구역", "k1", "A", 1), off("A구역", "k1", "A", 2)), 1)))
                .isInstanceOfSatisfying(SeatmapCancelConfirmRequiredException.class, ex -> {
                    assertThat(ex.getPreview().getCancelSeatCount()).isEqualTo(2);
                    assertThat(ex.getPreview().getCancelOrderCount()).isEqualTo(2);
                });
    }

    @Test
    void 제거된_좌석도_같은_규칙() {
        save(seat("A구역", "k1", "A", 1), seat("A구역", "k1", "A", 2));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        TicketingOrder order = book(e, "O1", seatAt("A", 1));

        save(1, seat("A구역", "k1", "A", 2));

        assertThat(reload(order).getStatus()).isEqualTo("CANCELLED");
        assertThat(reload(order).getPayment().getStatus()).isEqualTo("CANCELLED");
        assertThat(seqs()).containsOnlyKeys("A-2");
        assertThat(eventSeatCount()).isZero();
    }

    @Test
    void 지난_회차는_취소하지_않고_연결만_끊는다() {
        save(seat("A구역", "k1", "A", 1));
        Event past = eventAt("P1", LocalDateTime.now().minusDays(1));
        TicketingOrder order = book(past, "O1", seatAt("A", 1));

        save(seat("B구역", "k2", "A", 1)); // 409 없이 저장

        TicketingOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo("PAID");
        assertThat(after.getItems()).singleElement().satisfies(i -> {
            assertThat(i.isActive()).isTrue();
            assertThat(i.getEventSeat()).isNull();
        });
        assertThat(eventSeatCount()).isZero();
    }

    @Test
    void 판매되지_않은_회차좌석은_그냥_삭제() {
        save(seat("A구역", "k1", "A", 1));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        em.persist(EntityFixtures.eventSeat(e, seatAt("A", 1), SeatStatus.AVAILABLE, 0L));
        em.flush();
        em.clear();

        save(off("A구역", "k1", "A", 1));

        assertThat(eventSeatCount()).isZero();
        verify(snapshotCache).evict("E1");
    }

    @Test
    void 취소할_수_없는_상태의_주문은_취소하지_않고_연결만_끊는다() {
        save(seat("A구역", "k1", "A", 1));
        Event e = eventAt("E1", LocalDateTime.now().plusDays(10));
        TicketingOrder order = book(e, "O1", seatAt("A", 1));
        ReflectionTestUtils.setField(reload(order), "status", "CONFIRMED"); // 개발 시드 등 PAID 가 아닌 주문
        em.flush();
        em.clear();

        save(off("A구역", "k1", "A", 1)); // 확인 수 없이 저장된다

        TicketingOrder after = reload(order);
        assertThat(after.getStatus()).isEqualTo("CONFIRMED");
        assertThat(after.getItems()).singleElement().satisfies(i -> assertThat(i.getEventSeat()).isNull());
    }
}
