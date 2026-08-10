package cloudsoswift.podoR.domain.ticketing.controller;

import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderDetailResponse;
import cloudsoswift.podoR.domain.ticketing.dto.TicketingOrderSummaryResponse;
import cloudsoswift.podoR.domain.ticketing.service.TicketingOrderService;
import cloudsoswift.podoR.domain.ticketing.service.TicketingOrderService.DateBasis;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/users/mytickets")
public class TicketingOrderController {

    private final TicketingOrderService ticketingOrderService;

    @GetMapping
    public ResponseEntity<List<TicketingOrderSummaryResponse>> getMyTickets(
            @RequestParam(defaultValue = "WATCHED") DateBasis dateBasis,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        LocalDate now = LocalDate.now();
        int y = (year != null) ? year : now.getYear();
        int m = (month != null) ? month : now.getMonthValue();
        if (m < 1 || m > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must be 1..12");
        }
        return ResponseEntity.ok(ticketingOrderService.getMyOrders(userSeq, dateBasis, y, m));
    }

    @GetMapping("/{ticketId}")
    public ResponseEntity<TicketingOrderDetailResponse> getMyTicket(
            @PathVariable String ticketId,
            Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ticketingOrderService.getMyOrder(userSeq, ticketId));
    }
}
