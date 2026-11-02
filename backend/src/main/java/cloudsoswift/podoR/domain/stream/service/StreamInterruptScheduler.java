package cloudsoswift.podoR.domain.stream.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/** 끊긴 채 유예 시간(stream.interrupt-grace)을 넘긴 방송을 종료로 확정한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class StreamInterruptScheduler {

    private final StreamLifecycleService lifecycleService;

    @Scheduled(fixedDelayString = "PT30S")
    public void endExpired() {
        int ended = lifecycleService.endExpired(LocalDateTime.now());
        if (ended > 0) {
            log.info("ended {} interrupted stream(s) after grace period", ended);
        }
    }
}
