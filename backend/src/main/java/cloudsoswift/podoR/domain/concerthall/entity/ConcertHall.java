package cloudsoswift.podoR.domain.concerthall.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "concert_hall")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConcertHall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 1000)
    private String address;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "concert_hall_image", length = 500)
    private String concertHallImage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void update(String name, String address, String description, String concertHallImage) {
        this.name = name;
        this.address = address;
        this.description = description;
        this.concertHallImage = concertHallImage;
    }

    @Builder
    public ConcertHall(String name, String address, String description,
                       String concertHallImage) {
        this.name = name;
        this.address = address;
        this.description = description;
        this.concertHallImage = concertHallImage;
    }
}