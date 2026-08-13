package cloudsoswift.podoR.support;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.entity.SeatStatus;
import cloudsoswift.podoR.domain.seat.entity.Seat;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.user.entity.Role;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.venue.entity.Venue;

import java.time.LocalDateTime;

/** @DataJpaTest 픽스처용 un-persisted 엔티티 빌더 모음. 저장은 각 테스트의 TestEntityManager 가 담당. */
public final class EntityFixtures {

    private EntityFixtures() {}

    public static User user(String providerId) {
        return User.builder()
                .email(providerId + "@test.com").nickname("nick-" + providerId)
                .provider("KAKAO").providerId(providerId).role(Role.USER).build();
    }

    public static Venue venue(String name) {
        return Venue.builder().name(name).address("addr").build();
    }

    public static Seat seat(Venue venue, String section, String row, Integer number) {
        return Seat.builder().venue(venue).section(section).rowNumber(row)
                .seatNumber(number).isAvailable(true).build();
    }

    public static Event event(User host, Venue venue, String eventId, String seriesId) {
        LocalDateTime now = LocalDateTime.now();
        return Event.builder().host(host).venue(venue).eventId(eventId).seriesId(seriesId)
                .title("title").eventType("CONCERT").eventDate(now).ticketingDate(now).build();
    }

    public static EventSeat eventSeat(Event event, Seat seat, SeatStatus status, long changeVersion) {
        return EventSeat.builder().event(event).seat(seat).seatGrade("VIP").price(10000)
                .status(status).changeVersion(changeVersion).build();
    }

    public static TicketingOrder order(Event event, User user, String orderNumber, String status) {
        return TicketingOrder.builder().event(event).user(user).orderNumber(orderNumber)
                .totalPrice(10000).status(status).build();
    }

    public static TicketingItem item(TicketingOrder order, EventSeat eventSeat) {
        return TicketingItem.builder().ticketingOrder(order).eventSeat(eventSeat).build();
    }
}
