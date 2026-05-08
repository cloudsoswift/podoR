package cloudsoswift.podoR.security.oauth;

import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.security.oauth.provider.CustomOAuth2User;
import cloudsoswift.podoR.security.oauth.provider.OAuth2UserInfo;
import cloudsoswift.podoR.security.oauth.provider.OAuth2UserInfoFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService
        extends DefaultOAuth2UserService {
// OAuth2 로그인 시 provider로부터 받은 유저 정보를 DB와 동기화하는 역할의 Service
// 아래 함수들이 반환값들은 SuccessHandler의 authentication.getPrincipal()로 전달됨
    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest)
            throws OAuth2AuthenticationException {

        OAuth2User oAuth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration()
                .getRegistrationId();

        OAuth2UserInfo userInfo = OAuth2UserInfoFactory
                .getOAuth2UserInfo(registrationId, oAuth2User.getAttributes());

        // 이메일 필수 체크
        if (userInfo.getEmail() == null || userInfo.getEmail().isEmpty()) {
            throw new OAuth2AuthenticationException(
                    "Email not found from OAuth2 provider");
        }

        // DB에서 사용자 조회 또는 생성
        User user = userRepository
                .findByProviderAndProviderId(
                        userInfo.getProvider(),
                        userInfo.getProviderId())
                .orElseGet(() -> registerNewUser(userInfo));

        // 기존 사용자 정보 업데이트
        updateExistingUser(user, userInfo);

        return new CustomOAuth2User(user, oAuth2User.getAttributes());
    }

    private User registerNewUser(OAuth2UserInfo userInfo) {
        User user = User.builder()
                .email(userInfo.getEmail())
                .nickname(userInfo.getName())
                .provider(userInfo.getProvider())
                .providerId(userInfo.getProviderId())
                .profileImage(userInfo.getImageUrl())
                .role("USER")
                .build();

        return userRepository.save(user);
    }

    private void updateExistingUser(User user, OAuth2UserInfo userInfo) {
        user.updateProfile(
                userInfo.getName(),
                null,  // phone
                userInfo.getImageUrl()
        );
        userRepository.save(user);
    }
}