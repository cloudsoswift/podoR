package cloudsoswift.podoR.domain.user.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_user_provider",
                        columnNames = {"provider", "provider_id"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long seq;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 100)
    private String nickname;

    @Column(nullable = false, length = 20)
    @Comment("GOOGLE, KAKAO")
    private String provider;

    @Column(name = "provider_id", nullable = false, length = 255)
    @Comment("OAuth 제공자 고유의 ID")
    private String providerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("USER, ADMIN")
    private Role role = Role.USER;

    @Column(length = 50)
    private String phone;

    // LocalDate, LocalDateTime은 기존 Date와 달리 불변 객체이므로 더 안전하여 사용.
    private LocalDate birthday;

    @Column(name = "profile_image", length = 500)
    @Comment("Profile 이미지 URL")
    private String profileImage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }
    // 생성시 생성 시간 및 갱신 시각을 반영
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    // 내용 갱신시 갱신 시각을 반영
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Builder
    public User(String email, String nickname, String provider,
                String providerId, Role role, String phone,
                LocalDate birthday, String profileImage) {
        this.email = email;
        this.nickname = nickname;
        this.provider = provider;
        this.providerId = providerId;
        this.role = role != null ? role : Role.USER;
        this.phone = phone;
        this.birthday = birthday;
        this.profileImage = profileImage;
    }

    // 갱신 가능한 요소들에 대해서 갱신 수행하는 메서드
    public void updateProfile(String nickname, String profileImage) {
        this.nickname = nickname;
        this.profileImage = profileImage;
    }
}