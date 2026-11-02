package cloudsoswift.podoR.domain.stream.service;

import cloudsoswift.podoR.domain.event.entity.Event;
import cloudsoswift.podoR.domain.event.repository.EventRepository;
import cloudsoswift.podoR.domain.stream.dto.StreamViewResponse;
import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.stream.repository.StreamSessionRepository;
import cloudsoswift.podoR.domain.ticketing.repository.TicketingItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** 예매자 관람. 그 회차에 취소되지 않은 좌석이 있어야 볼 수 있다(VOD 도 같다). */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class StreamViewService {

    private final EventRepository eventRepository;
    private final StreamSessionRepository sessionRepository;
    private final TicketingItemRepository itemRepository;

    public StreamViewResponse view(Long userSeq, String eventId) {
        Event event = eventRepository.findByEventIdAndDeletedDateIsNull(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found: " + eventId));
        if (!itemRepository.existsPaidItem(userSeq, event.getSeq())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "예매한 관객만 볼 수 있습니다.");
        }
        StreamStatus status = event.effectiveStreamStatus();
        String liveUrl = status == StreamStatus.LIVE
                ? sessionRepository.findTopByEvent_SeqOrderBySessionNoDesc(event.getSeq())
                        .map(s -> "/media/hls/" + eventId + "/" + s.getSessionNo() + "/master.m3u8")
                        .orElse(null)
                : null;
        String vodUrl = event.getVodStatus() == VodStatus.READY ? "/media/vod/" + eventId + ".mp4" : null;
        return new StreamViewResponse(status.name(), event.getVodStatus().name(), liveUrl, vodUrl);
    }

    public List<String> watchableEventIds(Long userSeq, String seriesId) {
        return itemRepository.findWatchableEventIds(userSeq, seriesId);
    }
}
