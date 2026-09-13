package cloudsoswift.podoR.domain.queue.controller;

import cloudsoswift.podoR.domain.queue.TicketingQueueService;
import cloudsoswift.podoR.domain.queue.dto.QueueStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 가상 대기실 API. 예매 도메인(EventTicketingController)과 달리 이쪽 관심사는 입장 통제다.
 *
 * 이 엔드포인트 자체는 로그인만 필요하고 입장권은 필요 없다 — 입장권을 받으러 오는 곳이기 때문이다.
 * 폴링을 GET 이 아닌 POST 로 둔 이유: 등록·하트비트·승격으로 상태를 바꾸는 호출이라 GET 은 부정직하다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/events/{eventId}/queue")
public class WaitingQueueController {

    private final TicketingQueueService ticketingQueueService;

    @PostMapping
    public ResponseEntity<QueueStatusResponse> enterOrPoll(@PathVariable String eventId,
                                                           Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ticketingQueueService.enterOrPoll(eventId, userSeq));
    }

    @DeleteMapping
    public ResponseEntity<Void> leave(@PathVariable String eventId,
                                      Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        ticketingQueueService.leave(eventId, userSeq);
        return ResponseEntity.noContent().build();
    }
}
