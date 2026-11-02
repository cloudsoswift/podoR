package cloudsoswift.podoR.domain.stream.entity;

import cloudsoswift.podoR.domain.event.entity.Event;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 송출 한 번(OBS 접속부터 끊김까지). 재접속하면 ffmpeg 가 조각 번호를 0 부터 다시 매기므로
 * 세션마다 HLS 폴더(/hls/{eventId}/{sessionNo}/)를 나누고, VOD 는 sessionNo 순서로 이어 붙인다.
 */
@Entity
@Table(name = "stream_session",
        uniqueConstraints = @UniqueConstraint(name = "uk_stream_session_event_no",
                columnNames = {"event_seq", "session_no"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StreamSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_seq", nullable = false)
    private Event event;

    @Column(name = "session_no", nullable = false)
    private Integer sessionNo;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    public static StreamSession start(Event event, int sessionNo, LocalDateTime at) {
        StreamSession s = new StreamSession();
        s.event = event;
        s.sessionNo = sessionNo;
        s.startedAt = at;
        return s;
    }

    public void end(LocalDateTime at) {
        if (endedAt == null) {
            endedAt = at;
        }
    }
}
