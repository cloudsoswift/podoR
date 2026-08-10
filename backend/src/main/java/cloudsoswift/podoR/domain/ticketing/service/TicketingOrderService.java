package cloudsoswift.podoR.domain.ticketing.service;

import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderDetailResponse;
import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderSummaryResponse;
import cloudsoswift.podoR.domain.ticketing.entity.TicketingOrder;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 예매(TicketingOrder) 읽기 측. 추후 예매 생성 등 쓰기 기능을 확장해야 함.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TicketingOrderService {

    private final TicketingOrderRepository ticketingOrderRepository;

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
}
