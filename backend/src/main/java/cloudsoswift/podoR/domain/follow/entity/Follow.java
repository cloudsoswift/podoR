package cloudsoswift.podoR.domain.follow.entity;

import cloudsoswift.podoR.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "follow")
@IdClass(Follow.FollowId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Follow {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "follower_seq")
    private User follower;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performer_seq")
    private User performer;

    @Column(name = "followed_at", nullable = false, updatable = false)
    private LocalDateTime followedAt;

    @PrePersist
    protected void onCreate() {
        followedAt = LocalDateTime.now();
    }

    @Builder
    public Follow(User follower, User performer) {
        this.follower = follower;
        this.performer = performer;
    }

    // 복합 키 클래스
    // Follow는 [팔로워 일련번호, 공연자 일련번호]를 묶어서 유일함을 나타내는 복합키인 만큼,
    // 이 둘을 묶어 equals 기준으로 사용하는 FollowId 클래스를 이너 클래스로 만들고,
    // 이를 @IdClass()의 인자로 넘겨 'PK 정보를 담은 클래스 임'을 나타냄
    public static class FollowId implements Serializable {
        private Long follower;
        private Long performer;

        public FollowId() {}

        public FollowId(Long follower, Long performer) {
            this.follower = follower;
            this.performer = performer;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            FollowId followId = (FollowId) o;
            return Objects.equals(follower, followId.follower) &&
                    Objects.equals(performer, followId.performer);
        }

        @Override
        public int hashCode() {
            return Objects.hash(follower, performer);
        }
    }
}