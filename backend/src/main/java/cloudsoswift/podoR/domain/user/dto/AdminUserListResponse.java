package cloudsoswift.podoR.domain.user.dto;

import cloudsoswift.podoR.domain.user.entity.User;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class AdminUserListResponse {
    private final Long seq;
    private final String email;
    private final String nickname;
    private final String role;
    private final String provider;
    private final LocalDateTime createdAt;

    public AdminUserListResponse(User user) {
        this.seq = user.getSeq();
        this.email = user.getEmail();
        this.nickname = user.getNickname();
        this.role = user.getRole().name();
        this.provider = user.getProvider();
        this.createdAt = user.getCreatedAt();
    }
}
