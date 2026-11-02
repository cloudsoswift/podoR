package cloudsoswift.podoR.domain.stream.vod;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.stream.repository.StreamSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * 방송이 끝난 회차의 원본 화질 조각을 세션 순서대로 이어 mp4 VOD 로 만든다.
 *
 * 변환은 오래 걸리므로 트랜잭션 밖(전용 executor)에서 돌고, 상태 기록만 짧은 트랜잭션으로 한다.
 * 성공하면 라이브 HLS 폴더를 지우고, 실패하면 재시도할 수 있게 남긴다.
 */
@Slf4j
@Service
public class VodService implements VodRequester {

    private final EventRepository eventRepository;
    private final StreamSessionRepository sessionRepository;
    private final FfmpegRunner ffmpegRunner;
    private final StreamProperties props;
    private final TaskExecutor executor;
    private final TransactionTemplate tx;

    public VodService(EventRepository eventRepository, StreamSessionRepository sessionRepository,
                      FfmpegRunner ffmpegRunner, StreamProperties props,
                      @Qualifier("vodExecutor") TaskExecutor executor, TransactionTemplate tx) {
        this.eventRepository = eventRepository;
        this.sessionRepository = sessionRepository;
        this.ffmpegRunner = ffmpegRunner;
        this.props = props;
        this.executor = executor;
        this.tx = tx;
    }

    /** NONE/FAILED → PROCESSING 에 성공한 요청만 작업을 제출한다(중복 요청은 무시). */
    @Override
    public void requestBuild(Long eventSeq) {
        Integer changed = tx.execute(s -> eventRepository.transitVodStatus(
                eventSeq, List.of(VodStatus.NONE, VodStatus.FAILED), VodStatus.PROCESSING));
        if (changed == null || changed == 0) {
            return;
        }
        submitAfterCommit(eventSeq);
    }

    /** 실패했거나 시작되지 못한 VOD 를 다시 만든다(관리자). */
    public void retry(String eventId) {
        Event event = eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
        // NONE: 송출 중 종료 후 stopped 콜백이 유실돼 VOD 가 시작되지 못한 경우를 꺼내기 위한 것
        boolean stuck = event.getVodStatus() == VodStatus.FAILED || event.getVodStatus() == VodStatus.NONE;
        if (event.getStreamStatus() != StreamStatus.ENDED || !stuck) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "종료된 방송의 실패했거나 시작되지 않은 VOD 만 다시 만들 수 있습니다.");
        }
        requestBuild(event.getSeq());
    }

    /** 서버 재시작으로 PROCESSING 에 멈춘 작업을 다시 돌린다. */
    @EventListener(ApplicationReadyEvent.class)
    public void resumePending() {
        for (Event event : eventRepository.findAllByVodStatus(VodStatus.PROCESSING)) {
            Long seq = event.getSeq();
            executor.execute(() -> build(seq));
        }
    }

    public void build(Long eventSeq) {
        Event event = eventRepository.findById(eventSeq).orElse(null);
        if (event == null) {
            return;
        }
        String eventId = event.getEventId();
        Path root = Path.of(props.mediaRoot());
        Path hlsDir = root.resolve("hls").resolve(eventId);
        try {
            List<Path> segments = collectSegments(hlsDir, sessionRepository.findAllByEvent_SeqOrderBySessionNoAsc(eventSeq));
            if (segments.isEmpty()) {
                throw new IOException("no segments under " + hlsDir);
            }
            Path vodDir = Files.createDirectories(root.resolve("vod"));
            Path tmp = vodDir.resolve(eventId + ".mp4.tmp");
            ffmpegRunner.concatToMp4(segments, tmp);
            Files.move(tmp, vodDir.resolve(eventId + ".mp4"),
                    StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            markVod(eventSeq, VodStatus.READY);
            deleteRecursively(hlsDir);
        } catch (Exception e) {
            log.error("VOD build failed: event={}", eventId, e);
            markVod(eventSeq, VodStatus.FAILED);
        }
    }

    private List<Path> collectSegments(Path hlsDir, List<StreamSession> sessions) throws IOException {
        List<Path> segments = new ArrayList<>();
        for (StreamSession session : sessions) {
            Path src = hlsDir.resolve(String.valueOf(session.getSessionNo())).resolve("src");
            if (!Files.isDirectory(src)) {
                continue;
            }
            try (Stream<Path> files = Files.list(src)) {
                files.filter(p -> p.getFileName().toString().endsWith(".ts"))
                        .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                        .forEach(segments::add);
            }
        }
        return segments;
    }

    private void markVod(Long eventSeq, VodStatus to) {
        tx.executeWithoutResult(s -> eventRepository.transitVodStatus(eventSeq, List.of(VodStatus.PROCESSING), to));
    }

    // 상태 변경이 커밋된 뒤에 작업을 시작해야, 작업이 아직 안 보이는 PROCESSING 을 읽지 않는다.
    private void submitAfterCommit(Long eventSeq) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executor.execute(() -> build(eventSeq));
                }
            });
        } else {
            executor.execute(() -> build(eventSeq));
        }
    }

    private static void deleteRecursively(Path dir) throws IOException {
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            for (Path p : walk.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(p);
            }
        }
    }
}
