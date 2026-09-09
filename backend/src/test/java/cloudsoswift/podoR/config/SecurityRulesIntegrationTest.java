package cloudsoswift.podoR.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SecurityConfig 의 인가 규칙을 실제 필터 체인으로 검증한다.
 * 단위 테스트로는 확인할 수 없는 부분(permitAll 목록, 커스텀 401 엔트리포인트)이 대상이다.
 *
 * 주의: OAuth provider 를 호출하지 않는다. 로그인 흐름이 아니라 "인가 규칙"만 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityRulesIntegrationTest {

    @Autowired MockMvc mvc;

    /** JwtAuthenticationFilter 가 세팅하는 것과 동일한 형태(principal = userSeq) */
    private static Authentication user(long userSeq) {
        return new UsernamePasswordAuthenticationToken(
                userSeq, "token", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void 미인증으로_보호된_엔드포인트에_접근하면_401_과_커스텀_JSON_을_받는다() throws Exception {
        mvc.perform(get("/events/EVT1/my-seat-quota"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }

    @Test
    void 공개_GET_은_인증_없이_접근할_수_있다() throws Exception {
        mvc.perform(get("/events/series-summary"))
                .andExpect(status().isOk());
    }

    @Test
    void 공개는_GET_에만_해당한다_쓰기는_인증이_필요하다() throws Exception {
        mvc.perform(post("/events"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 인증된_사용자는_보호된_엔드포인트를_통과한다() throws Exception {
        // 인가를 통과해 컨트롤러까지 도달하면, 없는 이벤트이므로 404 가 된다(401 이 아니다).
        mvc.perform(get("/events/NO-SUCH-EVENT/my-seat-quota")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.authentication(user(100L))))
                .andExpect(status().isNotFound());
    }
}
