import { BASE_URL } from "@/mocks/handlers";
import { useAuthStore } from "@/store/authStore";
import { enterQueue, leaveQueueKeepalive } from "../queue";

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clearAuth();
});

test("enterQueue 는 POST /events/{id}/queue 의 응답을 돌려준다", async () => {
  // handlers.ts 기본 핸들러: ADMITTED
  const res = await enterQueue("E1");
  expect(res.status).toBe("ADMITTED");
});

test("leaveQueueKeepalive 는 페이지가 사라져도 전송되도록 keepalive fetch 로 DELETE 한다", () => {
  // axios(XHR)는 keepalive 를 못 쓰고, sendBeacon 은 Authorization 헤더를 못 붙인다.
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  useAuthStore.getState().setAccessToken("T");

  leaveQueueKeepalive("E1");

  expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/events/E1/queue`, {
    method: "DELETE",
    keepalive: true,
    headers: { Authorization: "Bearer T" },
  });
});
