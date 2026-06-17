package cloudsoswift.podoR.domain.user.repository;

import cloudsoswift.podoR.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // CustomOAuth2UserService에서 사용
    Optional<User> findByProviderAndProviderId(String provider, String providerId);

    // Admin: 삭제되지 않은 사용자 전체 (검색어 없음)
    Page<User> findByDeletedAtIsNull(Pageable pageable);

    // Admin: 삭제되지 않은 사용자 검색(이메일/닉네임 contains). keyword 는 non-null 전제.
    // (null 파라미터를 :keyword IS NULL 로 비교하면 PostgreSQL 이 타입을 bytea 로 추론해
    //  lower(bytea) 에러가 나므로, null 일 때는 위 findByDeletedAtIsNull 을 쓴다.)
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL AND (" +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(u.nickname) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<User> searchActiveUsers(@Param("keyword") String keyword, Pageable pageable);
}