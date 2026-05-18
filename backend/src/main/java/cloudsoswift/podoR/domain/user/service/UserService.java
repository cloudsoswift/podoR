package cloudsoswift.podoR.domain.user.service;

import cloudsoswift.podoR.domain.user.dto.UserInfoResponse;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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
                user.getProfileImage()
        );
    }
    public User findBySeq(Long userSeq) {
        return userRepository.findById(userSeq)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
