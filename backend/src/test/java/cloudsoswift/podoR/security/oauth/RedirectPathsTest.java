package cloudsoswift.podoR.security.oauth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RedirectPathsTest {

    @Test
    void 같은_출처의_상대경로는_그대로_통과한다() {
        List<String> safe = List.of(
                "/",
                "/events/E1/seats",
                "/a?b=c",
                // 스킴은 URL 맨 앞에 와야 동작한다. 앞에 / 가 붙으면 우리 사이트의 경로일 뿐이다.
                "/javascript:alert(1)",
                "/" + "a".repeat(511)); // 정확히 512자

        assertThat(safe).allSatisfy(p ->
                assertThat(RedirectPaths.sanitize(p)).as("통과해야 함: %s", p).isEqualTo(p));
    }

    @Test
    void 외부로_나가거나_스크립트를_실행할_수_있는_값은_거부한다() {
        List<String> unsafe = java.util.Arrays.asList(
                null,
                "",
                "events",                 // / 로 시작하지 않음
                "https://evil.com",
                "javascript:alert(1)",
                "//evil.com",             // 프로토콜 상대 URL
                "/\\evil.com",            // 브라우저가 \ 를 / 로 취급 → //evil.com
                "/\t/evil.com",           // 브라우저가 탭을 지운 뒤 해석 → //evil.com
                "/a\r\nSet-Cookie: x=y",  // 헤더 분할
                "/a",
                "/" + "a".repeat(512));   // 513자

        assertThat(unsafe).allSatisfy(p ->
                assertThat(RedirectPaths.sanitize(p)).as("거부해야 함: %s", p).isNull());
    }

    @Test
    void consume_는_세션_값을_꺼내면서_지우고_다시_검증한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession().setAttribute(RedirectPaths.SESSION_ATTRIBUTE, "/events/E1/seats");

        assertThat(RedirectPaths.consume(request)).isEqualTo("/events/E1/seats");
        assertThat(request.getSession().getAttribute(RedirectPaths.SESSION_ATTRIBUTE)).isNull();
        assertThat(RedirectPaths.consume(request)).isNull(); // 한 번만 쓸 수 있다
    }

    @Test
    void consume_는_세션에_위조된_값이_있으면_버리고_세션이_없으면_만들지_않는다() {
        MockHttpServletRequest tampered = new MockHttpServletRequest();
        tampered.getSession().setAttribute(RedirectPaths.SESSION_ATTRIBUTE, "//evil.com");
        assertThat(RedirectPaths.consume(tampered)).isNull();

        MockHttpServletRequest noSession = new MockHttpServletRequest();
        assertThat(RedirectPaths.consume(noSession)).isNull();
        assertThat(noSession.getSession(false)).isNull();
    }
}
