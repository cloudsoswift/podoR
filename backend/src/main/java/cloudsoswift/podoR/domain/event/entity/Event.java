package cloudsoswift.podoR.domain.event.entity;

import cloudsoswift.podoR.domain.stream.entity.StreamStatus;
import cloudsoswift.podoR.domain.stream.entity.VodStatus;
import cloudsoswift.podoR.domain.venue.entity.Venue;
import cloudsoswift.podoR.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;

import java.time.LocalDateTime;

@Entity
@Table(name = "event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_seq", nullable = false)
    private User host;

    @Column(name = "event_id", nullable = false, unique = true, length = 255)
    @Comment("UUID 형태의 이벤트 식별자")
    private String eventId;

    @Column(name = "series_id", nullable = false, length = 255)
    @Comment("같은 공연의 여러 회차를 묶는 그룹키")
    private String seriesId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "created_date", nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(name = "deleted_date")
    private LocalDateTime deletedDate;

    @Column(name = "event_date", nullable = false)
    private LocalDateTime eventDate;

    @Column(name = "ticketing_date", nullable = false)
    private LocalDateTime ticketingDate;

    @Column(name = "stream_key", length = 255)
    private String streamKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "stream_status", length = 20)
    @Comment("SCHEDULED, LIVE, INTERRUPTED, ENDED")
    private StreamStatus streamStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "vod_status", nullable = false, length = 20)
    @Comment("NONE, PROCESSING, READY, FAILED")
    private VodStatus vodStatus = VodStatus.NONE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_seq", nullable = false)
    private Venue venue;

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
    }

    @Builder
    public Event(User host, String eventId, String seriesId, String title, String content,
                 String eventType, LocalDateTime eventDate, LocalDateTime ticketingDate,
                 String streamKey, StreamStatus streamStatus, Venue venue) {
        this.host = host;
        this.eventId = eventId;
        this.seriesId = seriesId;
        this.title = title;
        this.content = content;
        this.eventType = eventType;
        this.eventDate = eventDate;
        this.ticketingDate = ticketingDate;
        this.streamKey = streamKey;
        this.streamStatus = streamStatus;
        this.venue = venue;
    }

    public void update(String title, String content, String eventType,
                       LocalDateTime eventDate, LocalDateTime ticketingDate, Venue venue) {
        this.title = title;
        this.content = content;
        this.eventType = eventType;
        this.eventDate = eventDate;
        this.ticketingDate = ticketingDate;
        this.venue = venue;
    }

    public void issueStreamKey(String key) {
        this.streamKey = key;
    }

    /** 스트리밍 도입 전 회차는 stream_status 가 NULL 일 수 있다 — 송출 전으로 본다. */
    public StreamStatus effectiveStreamStatus() {
        return streamStatus != null ? streamStatus : StreamStatus.SCHEDULED;
    }

    public void softDelete() {
        this.deletedDate = LocalDateTime.now();
    }
}
