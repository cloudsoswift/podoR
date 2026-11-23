package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.dto.PublishAuthRequest;
import cloudsoswift.podoR.domain.stream.dto.StreamStartedResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamSession;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.stream.policy.StreamPublishPolicy;
import cloudsoswift.podoR.domain.stream.repository.StreamSessionRepository;
import cloudsoswift.podoR.domain.stream.vod.VodRequester;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 방송 상태 전이. SCHEDULED → LIVE ⇄ INTERRUPTED → ENDED.
 *
 * 전이는 모두 조건부 UPDATE(현재 상태가 기대값일 때만)라, MediaMTX 콜백·유예 만료 스케줄러·
 * host 의 종료 버튼이 겹쳐도 하나만 이긴다.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class StreamLifecycleService {

    private static final String PATH_PREFIX = "live/";
    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "::1");
    private static final List<StreamStatus> ACTIVE = List.of(StreamStatus.LIVE, StreamStatus.INTERRUPTED);
    // LIVE 포함: stopped 콜백이 유실되면(Spring 재기동 중 OBS 끊김 등) LIVE 로 남는다. MediaMTX 는 한 경로에
    // 송출자를 하나만 받으므로, LIVE 회차에 새 publish 가 왔다는 것은 이전 송출이 이미 끊겼다는 뜻이다.
    private static final Set<StreamStatus> PUBLISHABLE =
            EnumSet.of(StreamStatus.SCHEDULED, StreamStatus.INTERRUPTED, StreamStatus.LIVE);
    private static final List<StreamStatus> STARTABLE =
            List.of(StreamStatus.SCHEDULED, StreamStatus.INTERRUPTED, StreamStatus.LIVE);

    private final EventRepository eventRepository;
    private final StreamSessionRepository sessionRepository;
    private final StreamPublishPolicy publishPolicy;
    private final StreamProperties props;
    private final VodRequester vodRequester;

    /** MediaMTX authHTTPAddress 판정. 시청은 nginx 경로로만 하므로 read 는 내부 ffmpeg(localhost)만 허용. */
    @Transactional(readOnly = true)
    public boolean authorize(PublishAuthRequest req, LocalDateTime now) {
        if ("read".equals(req.action())) {
            return LOOPBACK.contains(req.ip());
        }
        if (!"publish".equals(req.action())) {
            return false;
        }
        Optional<Event> found = keyOf(req.path()).flatMap(eventRepository::findByStreamKeyAndDeletedDateIsNull);
        if (found.isEmpty()) {
            return false;
        }
        Event event = found.get();
        return PUBLISHABLE.contains(event.effectiveStreamStatus())
                && publishPolicy.allows(event, now)
                && eventRepository.countByStreamStatusInAndSeqNot(ACTIVE, event.getSeq()) < props.maxConcurrent();
    }

    public StreamStartedResponse started(String streamKey, LocalDateTime now) {
        Event event = findByKey(streamKey);
        int changed = eventRepository.transitStreamStatus(event.getSeq(), STARTABLE, true, StreamStatus.LIVE);
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "송출을 시작할 수 없는 상태입니다.");
        }
        Optional<StreamSession> previous = sessionRepository.findTopByEvent_SeqOrderBySessionNoDesc(event.getSeq());
        // stopped 가 유실된 이전 세션은 지금 끊긴 것으로 닫는다
        previous.ifPresent(s -> s.end(now));
        int sessionNo = previous.map(s -> s.getSessionNo() + 1).orElse(1);
        sessionRepository.save(StreamSession.start(eventRepository.getReferenceById(event.getSeq()), sessionNo, now));
        String outputDir = props.mediaRoot() + "/hls/" + event.getEventId() + "/" + sessionNo;
        return new StreamStartedResponse(event.getEventId(), sessionNo, outputDir);
    }

    /**
     * 송출이 끊김. LIVE 면 INTERRUPTED(재접속 대기). 송출 중에 host 가 이미 종료(ENDED)했다면
     * 이제 쓰기가 끝났으므로 VOD 를 요청한다.
     */
    public void stopped(String streamKey, LocalDateTime now) {
        Optional<Event> found = eventRepository.findByStreamKeyAndDeletedDateIsNull(streamKey);
        if (found.isEmpty()) {
            return;
        }
        Long seq = found.get().getSeq();
        // 유예 만료 판정이 마지막 세션의 ended_at 을 보므로 상태보다 먼저 기록한다.
        sessionRepository.findTopByEvent_SeqOrderBySessionNoDesc(seq).ifPresent(s -> s.end(now));
        sessionRepository.flush();
        eventRepository.transitStreamStatus(seq, List.of(StreamStatus.LIVE), false, StreamStatus.INTERRUPTED);

        Event after = eventRepository.findById(seq).orElseThrow();
        if (after.getStreamStatus() == StreamStatus.ENDED && after.getVodStatus() == VodStatus.NONE) {
            vodRequester.requestBuild(seq);
        }
    }

    /**
     * host 의 "방송 종료". INTERRUPTED 면 바로 VOD 를 만든다. LIVE 면 OBS 가 아직 쓰는 중이므로
     * 상태만 ENDED 로 두고, OBS 가 끊겨 stopped 가 올 때 VOD 를 시작한다.
     */
    public void endByHost(String eventId) {
        Event event = eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
        Long seq = event.getSeq();
        if (eventRepository.transitStreamStatus(seq, List.of(StreamStatus.INTERRUPTED), false, StreamStatus.ENDED) == 1) {
            vodRequester.requestBuild(seq);
            return;
        }
        if (eventRepository.transitStreamStatus(seq, List.of(StreamStatus.LIVE), false, StreamStatus.ENDED) == 1) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "방송 중이 아닙니다.");
    }

    /** 끊긴 채 유예 시간을 넘긴 방송을 종료로 확정한다. 그 사이 재접속한 회차는 조건부 전이에서 빠진다. */
    public int endExpired(LocalDateTime now) {
        int ended = 0;
        for (Long seq : eventRepository.findInterruptedSince(now.minus(props.interruptGrace()))) {
            if (eventRepository.transitStreamStatus(seq, List.of(StreamStatus.INTERRUPTED), false, StreamStatus.ENDED) == 1) {
                vodRequester.requestBuild(seq);
                ended++;
            }
        }
        return ended;
    }

    private Event findByKey(String streamKey) {
        return eventRepository.findByStreamKeyAndDeletedDateIsNull(streamKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown stream key"));
    }

    private static Optional<String> keyOf(String path) {
        if (path == null || !path.startsWith(PATH_PREFIX)) {
            return Optional.empty();
        }
        String key = path.substring(PATH_PREFIX.length());
        return key.isBlank() || key.contains("/") ? Optional.empty() : Optional.of(key);
    }
}
