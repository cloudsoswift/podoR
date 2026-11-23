package cloudsoswift.podoR.domain.user.service;

import cloudsoswift.podoR.domain.user.entity.Role;
import cloudsoswift.podoR.domain.user.entity.User;
import cloudsoswift.podoR.domain.user.repository.UserRepository;
import cloudsoswift.podoR.support.EntityFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @InjectMocks UserService service;

    @Test
    void 역할을_HOST_로_바꾼다() {
        User target = EntityFixtures.user("t");
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));

        service.changeRole(1L, 2L, Role.HOST);

        assertThat(target.getRole()).isEqualTo(Role.HOST);
    }

    @Test
    void 자기_자신의_ADMIN_을_해제하면_400() {
        User me = User.builder().email("a@t.com").nickname("a").provider("KAKAO")
                .providerId("a").role(Role.ADMIN).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(me));

        assertThatThrownBy(() -> service.changeRole(1L, 1L, Role.USER))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(me.getRole()).isEqualTo(Role.ADMIN);
    }
}
