package cloudsoswift.podoR.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/**
 * 로그인 후 돌아갈 경로(redirect)를 검증한다. FE 의 safeRedirectPath 와 규칙이 같아야 한다.
 *
 * 같은 출처의 상대 경로만 허용한다. 그래서
 * - javascript:, data: 같은 스킴은 맨 앞에 와야 동작하므로 원천적으로 막히고
 * - //evil.com, /\evil.com, /<탭>/evil.com 처럼 브라우저가 외부 주소로 해석하는 형태를 거부하고
 * - CR/LF 로 Location 헤더를 끊는 것을 막는다.
 */
public final class RedirectPaths {

    public static final String SESSION_ATTRIBUTE = "OAUTH2_LOGIN_REDIRECT";
    public static final String PARAMETER = "redirect";

    static final int MAX_LENGTH = 512;

    private RedirectPaths() {
    }

    /** 안전하면 그대로, 아니면 null. */
    public static String sanitize(String raw) {
        if (raw == null || raw.isEmpty() || raw.length() > MAX_LENGTH) return null;
        if (raw.charAt(0) != '/') return null;
        if (raw.length() > 1 && (raw.charAt(1) == '/' || raw.charAt(1) == '\\')) return null;
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            // 브라우저는 URL 의 탭/줄바꿈을 지우고 해석한다: "/\t/evil.com" → "//evil.com"
            if (c <= 0x1F || c == 0x7F) return null;
        }
        return raw;
    }

    /**
     * resolver 가 보관한 복귀 경로를 꺼내고 즉시 지운다(한 번만 쓰인다).
     * 세션 값이라도 다시 검증한다 — 저장 이후 규칙이 바뀌었거나 다른 경로로 들어온 값일 수 있다.
     * 세션이 없으면 만들지 않는다.
     */
    public static String consume(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object value = session.getAttribute(SESSION_ATTRIBUTE);
        session.removeAttribute(SESSION_ATTRIBUTE);
        return value instanceof String s ? sanitize(s) : null;
    }
}
