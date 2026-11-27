package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.domain.ticketing.entity.TicketingItem;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.payment.PaymentProperties;
import cloudsoswift.podoR.domain.ticketing.repository.PaymentRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** 결제 페이지를 떠나 방치된 PENDING 주문을 EXPIRED 로 정리한다. */
@Service
@RequiredArgsConstructor
public class PendingOrderExpiry {

    private final TicketingOrderRepository orderRepository;
    private final TicketingItemRepository itemRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentProperties properties;

    /** 컷오프(now - pendingTtl)보다 오래된 PENDING 주문의 항목·결제·주문을 EXPIRED 로 바꾼다. 반환: 만료 주문 수. */
    @Transactional
    public int expireStale(LocalDateTime now) {
        LocalDateTime cutoff = now.minus(properties.pendingTtl());
        List<Long> seqs = orderRepository.findStaleSeqs(TicketingOrder.STATUS_PENDING, cutoff);
        if (seqs.isEmpty()) {
            return 0;
        }
        // 주문을 먼저 PENDING 조건으로 만료시키고, 항목·결제는 "만료된 주문"의 PENDING/READY 만 바꾼다.
        // 그 사이 확정(PAID)된 주문은 어느 단계에서도 건드리지 않는다.
        int expired = orderRepository.markExpired(seqs, TicketingOrder.STATUS_PENDING, TicketingOrder.STATUS_EXPIRED);
        itemRepository.markStatusByOrderSeqs(seqs, TicketingOrder.STATUS_EXPIRED,
                TicketingItem.STATUS_PENDING, TicketingItem.STATUS_EXPIRED);
        paymentRepository.markExpiredByOrderSeqs(seqs, TicketingOrder.STATUS_EXPIRED, "READY", "EXPIRED");
        return expired;
    }
}
