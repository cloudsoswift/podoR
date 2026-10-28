import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import apiClient from "@/lib/axios";
import { gatedEventId, QUEUE_PASS_LOST_EVENT, QueuePassLostDetail } from "../queuePassLost";

describe("gatedEventId — BE WebMvcConfig 의 게이트 경로와 같아야 한다", () => {
  test.each([
    ["/events/E1/seat-view", "E1"],
    ["/events/E1/seat-view/changes", "E1"],
    ["/events/E1/my-seat-quota", "E1"],
    ["/events/E1/holds", "E1"],
    ["/events/E1/holds?x=1", "E1"],
    ["/events/E1/order", "E1"],
  ])("게이트 대상 %s → %s", (url, expected) => {
    expect(gatedEventId(url)).toBe(expected);
  });

  test.each([
    "/events/E1/order/20260910-8C35D7AC", // 주문 취소는 게이트 대상이 아니다
    "/events/E1/queue",
    "/events/E1",
    "/admin/events/E1/seats",
    "",
    undefined,
  ])("대상 아님 %j", (url) => {
    expect(gatedEventId(url)).toBeNull();
  });
});

describe("axios 인터셉터", () => {
  const listener = jest.fn();

  beforeEach(() => {
    listener.mockReset();
    window.addEventListener(QUEUE_PASS_LOST_EVENT, listener);
  });
  afterEach(() => window.removeEventListener(QUEUE_PASS_LOST_EVENT, listener));

  test("게이트 대상의 403 이면 eventId 를 알리고, 호출부의 catch 는 그대로 실행된다", async () => {
    server.use(
      http.post(`${BASE_URL}/events/E1/holds`, () =>
        HttpResponse.json({ status: 403, detail: "입장 대기가 필요합니다." }, { status: 403 }),
      ),
    );

    await expect(apiClient.post("/events/E1/holds", { eventSeatSeqs: [1] })).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent<QueuePassLostDetail>).detail).toEqual({ eventId: "E1" });
  });

  test("게이트 대상이 아닌 403 은 알리지 않는다", async () => {
    server.use(
      http.delete(`${BASE_URL}/events/E1/order/N1`, () => HttpResponse.json({}, { status: 403 })),
    );

    await expect(apiClient.delete("/events/E1/order/N1")).rejects.toBeTruthy();

    expect(listener).not.toHaveBeenCalled();
  });
});
