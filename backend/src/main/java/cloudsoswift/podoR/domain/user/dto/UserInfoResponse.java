package cloudsoswift.podoR.domain.user.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserInfoResponse {
    private String email;
    private String nickname;
    private String profileImage;
}