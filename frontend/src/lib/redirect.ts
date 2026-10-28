/**
 * 로그인 후 돌아갈 경로(redirect)를 다룬다. 규칙은 BE RedirectPaths.sanitize 와 같아야 한다.
 *
 * 같은 출처의 상대 경로만 허용한다.
 * - javascript:, data: 같은 스킴은 URL 맨 앞에 와야 동작하므로 "/" 로 시작하는 값은 실행될 수 없다.
 * - 브라우저는 "\" 를 "/" 로 취급하고 탭/줄바꿈을 지운 뒤 해석하므로
 *   "/\evil.com", "/<탭>/evil.com" 도 "//evil.com"(외부 주소)이 된다 → 거부.
 *
 * URL 을 만드는 부분은 순수 함수로 둔다. jsdom 은 window.location.href 대입(실제 이동)을
 * 지원하지 않으므로, 페이지와 인터셉터는 여기서 만든 값을 대입만 한다.
 */

const MAX_LENGTH = 512;

export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (raw[0] !== "/") return null;
  if (raw[1] === "/" || raw[1] === "\\") return null;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return null;
  }
  return raw;
}

export function loginHref(path: string): string {
  const safe = safeRedirectPath(path);
  return safe ? `/login?redirect=${encodeURIComponent(safe)}` : "/login";
}

export type OAuthProvider = "google" | "kakao";

/** BE 의 OAuth 인가 시작 주소. redirect 는 BE 가 세션에 보관했다가 로그인 후 돌려준다. */
export function oauthAuthorizeUrl(apiBaseUrl: string, provider: OAuthProvider, redirect: string | null): string {
  const base = `${apiBaseUrl}/oauth2/authorization/${provider}`;
  const safe = safeRedirectPath(redirect);
  return safe ? `${base}?redirect=${encodeURIComponent(safe)}` : base;
}

/** refresh 실패로 로그인 페이지로 보낼 주소. */
export function loginRedirectUrl(location: { pathname: string; search: string }): string {
  // 이미 로그인 페이지면 그대로 둔다 — /login?redirect=/login?redirect=… 중첩 방지
  if (location.pathname === "/login") return location.pathname + location.search;
  // OAuth 콜백 페이지의 쿼리에는 accessToken 이 있다. 복귀 경로로 옮겨 적지 않는다.
  if (location.pathname === "/oauth2/redirect") return "/login";
  return loginHref(location.pathname + location.search);
}
