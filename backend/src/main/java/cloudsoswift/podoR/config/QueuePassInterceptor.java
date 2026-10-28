package cloudsoswift.podoR.config;

import cloudsoswift.podoR.domain.queue.WaitingQueueService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.security.Principal;
import java.util.Map;

/**
 * 예매 플로우 진입에 유효한 입장권을 요구한다. 각 컨트롤러에 흩뿌리지 않고 여기 한 곳에서 검증한다.
 *
 * 승격은 하지 않는다 — 큐에 대한 쓰기는 POST /queue 한 곳으로 모아 경로를 단순하게 유지한다.
 * 입장권이 사용 중 만료되면 다음 요청부터 403 이고 사용자는 줄 뒤로 돌아간다(고정 시간 입장권의 의도된 결과).
 */
@Component
@RequiredArgsConstructor
public class QueuePassInterceptor implements HandlerInterceptor {

    private final WaitingQueueService waitingQueue;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Long userSeq = userSeq(request);
        if (userSeq == null) {
            // 인증 여부는 SecurityConfig 소관이다(미인증은 여기 닿기 전에 401).
            return true;
        }
        String eventId = pathVariable(request, "eventId");
        if (eventId == null) {
            return true;
        }
        if (!waitingQueue.hasValidPass(eventId, userSeq)) {
            // ProblemDetail 이 활성화되어 있어 reason 이 detail 로 클라이언트에 전달된다.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "입장 대기가 필요합니다.");
        }
        return true;
    }

    /** JwtAuthenticationFilter 가 principal 에 userSeq(Long) 를 넣는다. */
    private static Long userSeq(HttpServletRequest request) {
        Principal principal = request.getUserPrincipal();
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof Long seq) {
            return seq;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static String pathVariable(HttpServletRequest request, String name) {
        Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        return (vars instanceof Map<?, ?> map) ? ((Map<String, String>) map).get(name) : null;
    }
}
