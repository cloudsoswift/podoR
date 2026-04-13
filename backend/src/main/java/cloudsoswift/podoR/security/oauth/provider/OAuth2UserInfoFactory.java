package cloudsoswift.podoR.security.oauth.provider;

import java.util.Map;

public class OAuth2UserInfoFactory {
    public static OAuth2UserInfo getOAuth2UserInfo(
            String registrationId,
            Map<String, Object> attributes) {

        if ("google".equals(registrationId)) {
            return new GoogleOAuth2UserInfo(attributes);
        } else if ("kakao".equals(registrationId)) {
            return new KakaoOAuth2UserInfo(attributes);
        }
        throw new IllegalArgumentException(
                "Unsupported provider: " + registrationId);
    }
}