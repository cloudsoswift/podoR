package cloudsoswift.podoR.security.oauth.provider;

import cloudsoswift.podoR.domain.user.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

public class CustomOAuth2User implements OAuth2User {

    private final User user;                      // getUser().getSeq() 호출 근거
    private final Map<String, Object> attributes; // OAuth2User 인터페이스 구현 필요

    public CustomOAuth2User(User user, Map<String, Object> attributes) {
        this.user = user;
        this.attributes = attributes;
    }

    public User getUser() {
        return user;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + user.getRole())
        );
    }

    @Override
    public String getName() {
        // OAuth2User 식별자 - providerId나 email 중 하나
        return user.getEmail();
    }
}