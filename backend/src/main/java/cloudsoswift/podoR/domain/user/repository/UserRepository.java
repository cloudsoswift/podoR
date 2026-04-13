package cloudsoswift.podoR.domain.user.repository;

import cloudsoswift.podoR.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // CustomOAuth2UserService에서 사용
    // findByProviderAndProviderId(userInfo.getProvider(), userInfo.getProviderId())
    Optional<User> findByProviderAndProviderId(String provider, String providerId);
}