package cloudsoswift.podoR.domain.user.dto;

import cloudsoswift.podoR.domain.user.entity.User;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
public class AdminUserDetailResponse {
    private final Long seq;
    private final String email;
    private final String nickname;
    private final String role;
    private final String provider;
    private final String phone;
    private final LocalDate birthday;
    private final String profileImage;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;
    private final LocalDateTime deletedAt;

    public AdminUserDetailResponse(User user) {
        this.seq = user.getSeq();
        this.email = user.getEmail();
        this.nickname = user.getNickname();
        this.role = user.getRole().name();
        this.provider = user.getProvider();
        this.phone = user.getPhone();
        this.birthday = user.getBirthday();
        this.profileImage = user.getProfileImage();
        this.createdAt = user.getCreatedAt();
        this.updatedAt = user.getUpdatedAt();
        this.deletedAt = user.getDeletedAt();
    }
}
