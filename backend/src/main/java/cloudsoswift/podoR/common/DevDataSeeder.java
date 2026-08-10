package cloudsoswift.podoR.common;

import cloudsoswift.podoR.domain.event.entity.EventSeat;
import cloudsoswift.podoR.domain.event.repository.EventSeatRepository;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * local 프로필 개발용: 예매내역 조회를 검증할 더미 TicketingOrder 1건.
 * 이미 주문이 있거나 유저/EventSeat 가 없으면 skip.
 */
@Log4j2
@Component
@Profile("local")
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

    private final TicketingOrderRepository ticketingOrderRepository;
    private final UserRepository userRepository;
    private final EventSeatRepository eventSeatRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (ticketingOrderRepository.count() > 0) return;

        List<User> users = userRepository.findAll();
        List<EventSeat> seats = eventSeatRepository.findAll();
        if (users.isEmpty() || seats.isEmpty()) {
            log.info("[DevDataSeeder] user/eventSeat 없음 — 예매 시드 skip");
            return;
        }
        User user = users.get(0);
        EventSeat seat = seats.get(0);

        int total = seat.getPrice() != null ? seat.getPrice() : 0;
        TicketingOrder order = TicketingOrder.builder()
                .event(seat.getEvent())
                .user(user)
                .orderNumber("DEV-" + UUID.randomUUID().toString().substring(0, 8))
                .totalPrice(total)
                .status("CONFIRMED")
                .build();
        order.addItem(TicketingItem.builder().eventSeat(seat).build());
        ticketingOrderRepository.save(order);
        log.info("[DevDataSeeder] 더미 예매 1건 생성(user={}, event={})",
                user.getSeq(), seat.getEvent().getSeq());
    }
}
