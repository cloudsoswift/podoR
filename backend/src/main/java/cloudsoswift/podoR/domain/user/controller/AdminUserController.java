package cloudsoswift.podoR.domain.user.controller;

import cloudsoswift.podoR.domain.user.dto.AdminUserDetailResponse;
import cloudsoswift.podoR.domain.user.dto.AdminUserListResponse;
import cloudsoswift.podoR.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<Page<AdminUserListResponse>> getUsers(
            @RequestParam(required = false) String keyword,
            Pageable pageable) {
        return ResponseEntity.ok(userService.getUsers(keyword, pageable));
    }

    @GetMapping("/{seq}")
    public ResponseEntity<AdminUserDetailResponse> getUser(@PathVariable Long seq) {
        return ResponseEntity.ok(userService.getUserDetail(seq));
    }

    @DeleteMapping("/{seq}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long seq) {
        userService.deleteUser(seq);
        return ResponseEntity.noContent().build();
    }
}
