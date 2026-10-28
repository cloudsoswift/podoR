import { loginHref, loginRedirectUrl, oauthAuthorizeUrl, safeRedirectPath } from "../redirect";

describe("safeRedirectPath — BE RedirectPaths.sanitize 와 같은 규칙", () => {
  test.each([
    "/",
    "/events/E1/seats",
    "/a?b=c",
    "/javascript:alert(1)", // 같은 출처의 경로일 뿐 실행되지 않는다
    "/" + "a".repeat(511),  // 정확히 512자
  ])("통과: %j", (p) => {
    expect(safeRedirectPath(p)).toBe(p);
  });

  test.each([
    null,
    undefined,
    "",
    "events",
    "https://evil.com",
    "javascript:alert(1)",
    "//evil.com",
    "/\\evil.com",           // 브라우저가 \ 를 / 로 취급
    "/\t/evil.com",          // 브라우저가 탭을 지운 뒤 해석 → //evil.com
    "/a\r\nx",
    "/a",
    "/" + "a".repeat(512),   // 513자
  ])("거부: %j", (p) => {
    expect(safeRedirectPath(p)).toBeNull();
  });
});

test("loginHref 는 경로를 인코딩해 싣고, 안전하지 않으면 싣지 않는다", () => {
  expect(loginHref("/events/E1/seats?x=1")).toBe("/login?redirect=%2Fevents%2FE1%2Fseats%3Fx%3D1");
  expect(loginHref("//evil.com")).toBe("/login");
});

test("oauthAuthorizeUrl 은 BE 인가 시작 주소에 redirect 를 전달한다", () => {
  expect(oauthAuthorizeUrl("http://api", "kakao", "/events/E1/seats")).toBe(
    "http://api/oauth2/authorization/kakao?redirect=%2Fevents%2FE1%2Fseats",
  );
  expect(oauthAuthorizeUrl("http://api", "google", null)).toBe("http://api/oauth2/authorization/google");
  expect(oauthAuthorizeUrl("http://api", "google", "//evil.com")).toBe("http://api/oauth2/authorization/google");
});

describe("loginRedirectUrl — 401 로 로그인 페이지로 보낼 때의 주소", () => {
  test("현재 경로와 쿼리를 싣는다", () => {
    expect(loginRedirectUrl({ pathname: "/events/E1/seats/payment", search: "?seats=1,2" })).toBe(
      "/login?redirect=%2Fevents%2FE1%2Fseats%2Fpayment%3Fseats%3D1%2C2",
    );
  });

  test("이미 로그인 페이지면 그대로 둔다(redirect 중첩 방지)", () => {
    expect(loginRedirectUrl({ pathname: "/login", search: "?redirect=%2Fa" })).toBe("/login?redirect=%2Fa");
  });

  test("OAuth 콜백 페이지면 싣지 않는다 — URL 에 accessToken 이 들어 있다", () => {
    expect(loginRedirectUrl({ pathname: "/oauth2/redirect", search: "?accessToken=T" })).toBe("/login");
  });
});
