import { delay, http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import apiClient from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

/**
 * AT 만료(401) 시 토큰을 재발급받아 원래 요청을 재시도하는 흐름을 고정함.
 *
 * 특히 좌석/대기열 쪽에서 폴링이 빈번하게 발생하므로, 
 * "동시에 401 에러를 받아도 refresh 는 한 번만" 처리하는 부분이 핵심임.
 */
beforeEach(() => {
  useAuthStore.getState().clearAuth();
  useAuthStore.getState().setAccessToken("OLD");
});

afterEach(() => {
  useAuthStore.getState().clearAuth();
});

test("동시에 401을 받아도 refresh는 한 번만 나가고, 대기하던 요청들은 새 토큰으로 재시도된다", async () => {
  let refreshCalls = 0;

  server.use(
    http.post(`${BASE_URL}/oauth2/token/refresh`, async () => {
      refreshCalls += 1;
      await delay(20); // 뒤따르는 401들이 겹쳐 들어오도록 지연
      return HttpResponse.json({ accessToken: "NEW" });
    }),
    // 새 토큰으로 온 요청만 통과시킨다
    http.get(`${BASE_URL}/users/me`, ({ request }) =>
      request.headers.get("Authorization") === "Bearer NEW"
        ? HttpResponse.json({ nickname: "tester" })
        : new HttpResponse(null, { status: 401 }),
    ),
  );

  const results = await Promise.all([
    apiClient.get("/users/me"),
    apiClient.get("/users/me"),
    apiClient.get("/users/me"),
  ]);

  expect(refreshCalls).toBe(1);
  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(useAuthStore.getState().accessToken).toBe("NEW");
});

test("refresh가 실패하면 인증 상태를 비우고 원래 요청도 실패한다", async () => {
  // jsdom 은 실제 페이지 이동을 지원하지 않으므로 "Not implemented: navigation" 경고가 찍힌다.
  // 이동 주소 조립은 lib/redirect 의 loginRedirectUrl 테스트가 담당한다.
  server.use(
    http.post(`${BASE_URL}/oauth2/token/refresh`, () => new HttpResponse(null, { status: 401 })),
    http.get(`${BASE_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
  );

  await expect(apiClient.get("/users/me")).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(useAuthStore.getState().accessToken).toBeNull();
});

test("401이 아닌 오류는 재발급을 시도하지 않는다", async () => {
  let refreshCalls = 0;

  server.use(
    http.post(`${BASE_URL}/oauth2/token/refresh`, () => {
      refreshCalls += 1;
      return HttpResponse.json({ accessToken: "NEW" });
    }),
    http.get(`${BASE_URL}/users/me`, () => new HttpResponse(null, { status: 500 })),
  );

  await expect(apiClient.get("/users/me")).rejects.toMatchObject({
    response: { status: 500 },
  });
  expect(refreshCalls).toBe(0);
  expect(useAuthStore.getState().accessToken).toBe("OLD");
});
