package cloudsoswift.podoR.domain.ticketing.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/** 방치 만료를 주기적으로 돌린다. 트랜잭션 프록시를 거치도록 {@link PendingOrderExpiry} 와 빈을 나눴다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PendingOrderExpiryScheduler {

    private final PendingOrderExpiry expiry;

    @Scheduled(fixedDelayString = "PT1M")
    public void run() {
        int expired = expiry.expireStale(LocalDateTime.now());
        if (expired > 0) {
            log.info("expired {} abandoned pending order(s)", expired);
        }
    }
}
