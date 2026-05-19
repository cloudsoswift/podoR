package cloudsoswift.podoR.domain.user.controller;

import cloudsoswift.podoR.domain.user.dto.UserInfoResponse;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        UserInfoResponse response = userService.getMyInfo(userSeq);
        return ResponseEntity.ok(response);
    }
}