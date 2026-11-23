package cloudsoswift.podoR.config;

import cloudsoswift.podoR.domain.stream.StreamProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * MediaMTX 내부 콜백의 공유 비밀 검사. 콜백 스크립트는 X-Internal-Token 헤더로,
 * authHTTPAddress 는 헤더를 붙일 수 없어 ?token= 쿼리로 보낸다.
 * 설정값이 비어 있으면 모두 거부한다(설정 누락이 "누구나 통과"가 되지 않게).
 *
 * 빈으로 등록하지 않고 WebMvcConfig 가 만든다 — @WebMvcTest 슬라이스가 인터셉터 빈을
 * 끌어와 StreamProperties 없이 실패하는 것을 피한다.
 */
@RequiredArgsConstructor
public class InternalTokenInterceptor implements HandlerInterceptor {

    static final String HEADER = "X-Internal-Token";

    private final StreamProperties props;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String expected = props.internalToken();
        String given = request.getHeader(HEADER);
        if (given == null) {
            given = request.getParameter("token");
        }
        if (expected == null || expected.isBlank() || given == null
                || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        return true;
    }
}
