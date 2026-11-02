package cloudsoswift.podoR.domain.user.service;

import cloudsoswift.podoR.domain.user.dto.AdminUserDetailResponse;
import cloudsoswift.podoR.domain.user.dto.AdminUserListResponse;
import cloudsoswift.podoR.domain.user.dto.UserInfoResponse;
import cloudsoswift.podoR.domain.user.entity.Role;
import cloudsoswift.podoR.domain.user.entity.User;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public UserInfoResponse getMyInfo(Long userSeq) {
        User user = userRepository.findById(userSeq)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new UserInfoResponse(
                user.getEmail(),
                user.getNickname(),
                user.getProfileImage(),
                user.getRole().name()
        );
    }
    public User findBySeq(Long userSeq) {
        return userRepository.findById(userSeq)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * 인증 경로용 조회. 존재하지 않거나 탈퇴한 사용자면 비어 있는 Optional 을 돌려준다.
     * 토큰 재발급처럼 "탈퇴한 사용자에게 새 권한을 주면 안 되는" 곳에서 사용한다.
     */
    public java.util.Optional<User> findActiveBySeq(Long userSeq) {
        return userRepository.findBySeqAndDeletedAtIsNull(userSeq);
    }

    // ===== Admin =====

    public Page<AdminUserListResponse> getUsers(String keyword, Pageable pageable) {
        String kw = (keyword != null && !keyword.isBlank()) ? keyword.trim() : null;
        Page<User> users = (kw == null)
                ? userRepository.findByDeletedAtIsNull(pageable)
                : userRepository.searchActiveUsers(kw, pageable);
        return users.map(AdminUserListResponse::new);
    }

    public AdminUserDetailResponse getUserDetail(Long seq) {
        return new AdminUserDetailResponse(findBySeq(seq));
    }

    /** 자기 자신의 ADMIN 해제는 막는다 — 관리자가 한 명뿐이면 아무도 관리 화면에 못 들어온다. */
    @Transactional
    public void changeRole(Long actorSeq, Long targetSeq, Role role) {
        if (role == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "역할을 지정해야 합니다.");
        }
        User target = userRepository.findById(targetSeq)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (actorSeq.equals(targetSeq) && target.getRole() == Role.ADMIN && role != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신의 관리자 권한은 해제할 수 없습니다.");
        }
        target.changeRole(role);
    }

    @Transactional
    public void deleteUser(Long seq) {
        User user = findBySeq(seq);
        // 멱등: 이미 삭제된 사용자면 deletedAt 을 재갱신하지 않고 최초 삭제 시각을 보존한다.
        if (!user.isDeleted()) {
            user.delete();
        }
    }
}
