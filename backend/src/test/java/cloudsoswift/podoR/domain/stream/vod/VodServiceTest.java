package cloudsoswift.podoR.domain.stream.vod;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.stream.repository.StreamSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VodServiceTest {

    @TempDir Path root;

    EventRepository eventRepository = mock(EventRepository.class);
    StreamSessionRepository sessionRepository = mock(StreamSessionRepository.class);
    FfmpegRunner runner = mock(FfmpegRunner.class);
    VodService service;
    Event event;

    static final long SEQ = 7L;

    @BeforeEach
    void setUp() {
        StreamProperties props = new StreamProperties("rtmp://h/live", 1, Duration.ofMinutes(3), "t", "s", root.toString());
        service = new VodService(eventRepository, sessionRepository, runner, props, new SyncTaskExecutor(),
                new TransactionTemplate(mock(PlatformTransactionManager.class)));
        event = event(StreamStatus.ENDED, VodStatus.PROCESSING);
        when(eventRepository.findById(SEQ)).thenReturn(Optional.of(event));
        when(eventRepository.findByEventIdAndDeletedDateIsNull("E1")).thenReturn(Optional.of(event));
    }

    private static Event event(StreamStatus status, VodStatus vod) {
        LocalDateTime now = LocalDateTime.now();
        Event e = Event.builder().eventId("E1").seriesId("S").title("t").eventType("C")
                .eventDate(now).ticketingDate(now).streamStatus(status).build();
        ReflectionTestUtils.setField(e, "seq", SEQ);
        ReflectionTestUtils.setField(e, "vodStatus", vod);
        return e;
    }

    private void sessions(int... nos) {
        List<StreamSession> list = new ArrayList<>();
        for (int n : nos) list.add(StreamSession.start(event, n, LocalDateTime.now()));
        when(sessionRepository.findAllByEvent_SeqOrderBySessionNoAsc(SEQ)).thenReturn(list);
    }

    private Path segment(int sessionNo, String name) throws IOException {
        Path dir = root.resolve("hls/E1/" + sessionNo + "/src");
        Files.createDirectories(dir);
        return Files.writeString(dir.resolve(name), "ts");
    }

    @Test
    void 세션_순서대로_원본_조각을_넘기고_성공하면_READY_와_HLS_삭제() throws Exception {
        sessions(1, 2);
        Path a = segment(1, "00000.ts");
        Path b = segment(1, "00001.ts");
        Path c = segment(2, "00000.ts");
        Files.createDirectories(root.resolve("hls/E1/1/480p"));
        doAnswer(inv -> {
            Files.writeString(inv.getArgument(1, Path.class), "mp4");
            return null;
        }).when(runner).concatToMp4(anyList(), any());

        service.build(SEQ);

        verify(runner).concatToMp4(eq(List.of(a, b, c)), any());
        assertThat(root.resolve("vod/E1.mp4")).exists();
        assertThat(root.resolve("hls/E1")).doesNotExist();
        verify(eventRepository).transitVodStatus(SEQ, List.of(VodStatus.PROCESSING), VodStatus.READY);
    }

    @Test
    void 조각이_없으면_FAILED() throws Exception {
        sessions(1);

        service.build(SEQ);

        verify(runner, never()).concatToMp4(anyList(), any());
        verify(eventRepository).transitVodStatus(SEQ, List.of(VodStatus.PROCESSING), VodStatus.FAILED);
    }

    @Test
    void runner_예외면_FAILED_이고_HLS_유지() throws Exception {
        sessions(1);
        segment(1, "00000.ts");
        doThrow(new IOException("ffmpeg exit 1")).when(runner).concatToMp4(anyList(), any());

        service.build(SEQ);

        verify(eventRepository).transitVodStatus(SEQ, List.of(VodStatus.PROCESSING), VodStatus.FAILED);
        assertThat(root.resolve("hls/E1/1/src/00000.ts")).exists();
        assertThat(root.resolve("vod/E1.mp4")).doesNotExist();
    }

    @Test
    void PROCESSING_중_중복_requestBuild_는_제출하지_않는다() throws Exception {
        when(eventRepository.transitVodStatus(SEQ, List.of(VodStatus.NONE, VodStatus.FAILED), VodStatus.PROCESSING))
                .thenReturn(0);

        service.requestBuild(SEQ);

        verify(sessionRepository, never()).findAllByEvent_SeqOrderBySessionNoAsc(any());
        verify(runner, never()).concatToMp4(anyList(), any());
    }

    @Test
    void FAILED_가_아니면_retry_는_409() {
        ReflectionTestUtils.setField(event, "vodStatus", VodStatus.READY);

        assertThatThrownBy(() -> service.retry("E1"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void ENDED_NONE_으로_멈춘_회차도_retry_할_수_있다() throws Exception {
        // 송출 중 종료 후 stopped 콜백이 유실되면 ENDED+NONE 에 갇힌다 — 관리자가 꺼낼 수 있어야 한다.
        ReflectionTestUtils.setField(event, "vodStatus", VodStatus.NONE);
        when(eventRepository.transitVodStatus(SEQ, List.of(VodStatus.NONE, VodStatus.FAILED), VodStatus.PROCESSING))
                .thenReturn(1);
        sessions(1);
        segment(1, "00000.ts");

        service.retry("E1");

        verify(runner).concatToMp4(anyList(), any());
    }

    @Test
    void 기동시_PROCESSING_으로_남은_회차는_다시_만든다() throws Exception {
        when(eventRepository.findAllByVodStatus(VodStatus.PROCESSING)).thenReturn(List.of(event));
        sessions(1);
        segment(1, "00000.ts");

        service.resumePending();

        verify(runner).concatToMp4(anyList(), any());
    }
}
