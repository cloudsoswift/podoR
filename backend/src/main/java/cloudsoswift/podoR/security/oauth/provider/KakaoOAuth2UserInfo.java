package cloudsoswift.podoR.security.oauth.provider;

import java.util.Map;

public class KakaoOAuth2UserInfo implements OAuth2UserInfo {
    private final Map<String, Object> attributes;

    public KakaoOAuth2UserInfo(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    @Override
    public String getProviderId() {
        return String.valueOf(attributes.get("id"));
    }

    @Override
    public String getProvider() {
        return "kakao";
    }

    @Override
    public String getEmail() {
        Map<String, Object> kakaoAccount = getMap(attributes, "kakao_account");
        if (kakaoAccount == null) return null;
        return (String) kakaoAccount.get("email");
    }

    @Override
    public String getName() {

        Map<String, Object> kakaoAccount = getMap(attributes, "kakao_account");
        if (kakaoAccount == null) return null;

        Map<String, Object> profile = getMap(kakaoAccount, "profile");
        if (profile == null) return null;

        return (String) profile.get("nickname");
    }

    @Override
    public String getImageUrl() {
        Map<String, Object> kakaoAccount = getMap(attributes, "kakao_account");
        if (kakaoAccount == null) return null;

        Map<String, Object> profile = getMap(kakaoAccount, "profile");
        if (profile == null) return null;

        return (String) profile.get("profile_image_url");
    }

    // 캐스팅을 한 곳에서만 관리 → @SuppressWarnings 범위 최소화
    @SuppressWarnings("unchecked")
    private Map<String, Object> getMap(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return null;
    }
}