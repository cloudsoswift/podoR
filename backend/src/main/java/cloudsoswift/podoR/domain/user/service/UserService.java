package cloudsoswift.podoR.domain.user.service;

import cloudsoswift.podoR.domain.user.dto.AdminUserDetailResponse;
import cloudsoswift.podoR.domain.user.dto.AdminUserListResponse;
import cloudsoswift.podoR.domain.user.dto.UserInfoResponse;
import cloudsoswift.podoR.domain.user.entity.User;
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

    @Transactional
    public void deleteUser(Long seq) {
        User user = findBySeq(seq);
        // 멱등: 이미 삭제된 사용자면 deletedAt 을 재갱신하지 않고 최초 삭제 시각을 보존한다.
        if (!user.isDeleted()) {
            user.delete();
        }
    }
}
