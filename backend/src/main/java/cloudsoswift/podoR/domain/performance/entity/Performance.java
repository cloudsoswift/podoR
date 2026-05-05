package cloudsoswift.podoR.domain.performance.entity;

import cloudsoswift.podoR.domain.concerthall.entity.ConcertHall;
import cloudsoswift.podoR.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;

import java.time.LocalDateTime;

@Entity
@Table(name = "performance")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Performance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performer_seq", nullable = false)
    private User performer;

    @Column(name = "performance_id", nullable = false, unique = true, length = 255)
    @Comment("UUID 형태의 공연 식별자")
    private String performanceId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "performance_type", nullable = false, length = 50)
    private String performanceType;

    @Column(name = "created_date", nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(name = "deleted_date")
    private LocalDateTime deletedDate;

    @Column(name = "perform_date", nullable = false)
    private LocalDateTime performDate;

    @Column(name = "ticketing_date", nullable = false)
    private LocalDateTime ticketingDate;

    @Column(name = "stream_key", length = 255)
    private String streamKey;

    @Column(name = "stream_status", length = 20)
    @Comment("SCHEDULED, LIVE, ENDED")
    private String streamStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hall_seq", nullable = false)
    private ConcertHall concertHall;

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
    }

    @Builder
    public Performance(User performer, String performanceId, String title,
                       String content, String performanceType, LocalDateTime performDate,
                       LocalDateTime ticketingDate, String streamKey,
                       String streamStatus, ConcertHall concertHall) {
        this.performer = performer;
        this.performanceId = performanceId;
        this.title = title;
        this.content = content;
        this.performanceType = performanceType;
        this.performDate = performDate;
        this.ticketingDate = ticketingDate;
        this.streamKey = streamKey;
        this.streamStatus = streamStatus;
        this.concertHall = concertHall;
    }

    // 비즈니스 메서드
    public void updateStreamStatus(String status) {
        this.streamStatus = status;
    }
    // 논리 삭제 처리
    public void softDelete() {
        this.deletedDate = LocalDateTime.now();
    }
}