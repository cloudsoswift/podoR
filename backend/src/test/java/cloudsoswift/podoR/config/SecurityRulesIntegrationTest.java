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

    private static Authentication withRole(long userSeq, String role) {
        return new UsernamePasswordAuthenticationToken(
                userSeq, "token", List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void USER_는_회차를_등록할_수_없다_403() throws Exception {
        mvc.perform(post("/events")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{}")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.authentication(withRole(100L, "USER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void HOST_는_회차_등록_인가를_통과한다() throws Exception {
        // 인가만 본다. 없는 사용자·공연장이라 서비스에서 실패하는 것은 무관하다(403 만 아니면 된다).
        int code;
        try {
            code = mvc.perform(post("/events")
                            .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{}")
                            .with(org.springframework.security.test.web.servlet.request
                                    .SecurityMockMvcRequestPostProcessors.authentication(withRole(100L, "HOST"))))
                    .andReturn().getResponse().getStatus();
        } catch (jakarta.servlet.ServletException e) {
            return; // 컨트롤러까지 도달해 서비스 예외가 전파됨 = 인가 통과
        }
        org.assertj.core.api.Assertions.assertThat(code).isNotEqualTo(403);
    }

    @Test
    void 타인의_스트림_키는_403() throws Exception {
        // 빈 DB 라 사용자 100 은 어떤 회차의 host 도 아니다(EventSecurity.isOwner = false).
        mvc.perform(get("/events/OTHER/stream-key")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.authentication(withRole(100L, "HOST"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void 내부_콜백은_로그인_없이_토큰만으로_통과한다() throws Exception {
        // MediaMTX 는 JWT 가 없다. 모르는 키의 끊김 통보는 조용히 무시(204)된다.
        mvc.perform(post("/internal/stream/stopped")
                        .header("X-Internal-Token", "test-internal-token")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"streamKey\":\"NO-SUCH-KEY\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/internal/stream/stopped")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"streamKey\":\"NO-SUCH-KEY\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 인증된_사용자는_보호된_엔드포인트를_통과한다() throws Exception {
        // 인가를 통과해 컨트롤러까지 도달하면, 없는 이벤트이므로 404 가 된다(401 이 아니다).
        //
        // 대기열 엔드포인트를 고른 이유 두 가지:
        //  1) 입장권 게이트 대상이 아니다(입장권을 받으러 오는 곳이므로). 게이트가 걸린 경로면
        //     인터셉터가 컨트롤러 앞에서 끊어버려 이 테스트가 보려는 404 를 볼 수 없다.
        //  2) 없는 이벤트라서 Redis 에 닿지 않는다. TicketingQueueService 가 findEvent() 를 먼저
        //     해서 404 를 던지고, waitingQueue 는 호출하지 않는다.
        //
        // 두 조건은 별개다. 실재하는 이벤트로 부르면 게이트 대상이 아니어도 Redis 를 쓴다.
        mvc.perform(post("/events/NO-SUCH-EVENT/queue")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.authentication(user(100L))))
                .andExpect(status().isNotFound());
    }
}
