package cloudsoswift.podoR.config;

import cloudsoswift.podoR.domain.stream.StreamProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class InternalTokenInterceptorTest {

    private static InternalTokenInterceptor interceptor(String token) {
        return new InternalTokenInterceptor(
                new StreamProperties("rtmp://h/live", 1, Duration.ofMinutes(3), token, "s", "/media"));
    }

    private static boolean pass(InternalTokenInterceptor i, MockHttpServletRequest req,
                                MockHttpServletResponse res) throws Exception {
        return i.preHandle(req, res, new Object());
    }

    @Test
    void 헤더_토큰이_맞으면_통과() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-Internal-Token", "secret-1");
        assertThat(pass(interceptor("secret-1"), req, new MockHttpServletResponse())).isTrue();
    }

    @Test
    void 쿼리_토큰이_맞으면_통과() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setParameter("token", "secret-1");
        assertThat(pass(interceptor("secret-1"), req, new MockHttpServletResponse())).isTrue();
    }

    @Test
    void 없거나_틀리면_401() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(pass(interceptor("secret-1"), new MockHttpServletRequest(), res)).isFalse();
        assertThat(res.getStatus()).isEqualTo(401);

        MockHttpServletRequest wrong = new MockHttpServletRequest();
        wrong.addHeader("X-Internal-Token", "secret-2");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        assertThat(pass(interceptor("secret-1"), wrong, res2)).isFalse();
        assertThat(res2.getStatus()).isEqualTo(401);
    }

    @Test
    void 설정값이_비면_401() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-Internal-Token", "");
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(pass(interceptor(""), req, res)).isFalse();
        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(pass(interceptor(null), req, new MockHttpServletResponse())).isFalse();
    }
}
