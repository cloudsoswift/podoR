package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.StreamProperties;
import cloudsoswift.podoR.domain.stream.dto.StreamKeyResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;

/** 회차 스트림 키. 회차 생성 시가 아니라 host 가 처음 요청할 때 발급한다. */
@Service
@Transactional
@RequiredArgsConstructor
public class StreamKeyService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EventRepository eventRepository;
    private final StreamProperties props;

    public StreamKeyResponse getOrIssue(String eventId) {
        Event event = findEvent(eventId);
        if (event.getStreamKey() == null) {
            event.issueStreamKey(newKey());
        }
        return toResponse(event);
    }

    /** 송출 중에 키를 바꾸면 재접속이 막히므로 LIVE·INTERRUPTED 에서는 거부한다. */
    public StreamKeyResponse reissue(String eventId) {
        Event event = findEvent(eventId);
        if (EnumSet.of(StreamStatus.LIVE, StreamStatus.INTERRUPTED).contains(event.effectiveStreamStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "방송 중에는 스트림 키를 재발급할 수 없습니다.");
        }
        event.issueStreamKey(newKey());
        return toResponse(event);
    }

    private StreamKeyResponse toResponse(Event event) {
        return new StreamKeyResponse(event.getStreamKey(), props.rtmpUrl(), event.effectiveStreamStatus().name());
    }

    private Event findEvent(String eventId) {
        return eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
    }

    // 32바이트 → URL-safe Base64(패딩 없음) 43자. MediaMTX 경로(live/{key})에 그대로 쓸 수 있다.
    private static String newKey() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
