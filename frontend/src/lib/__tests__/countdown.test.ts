import { act, renderHook } from "@testing-library/react";
import { formatCountdown } from "../countdown";
import { useNow } from "../useNow";

describe("formatCountdown", () => {
  test.each([
    [252_000, "04:12"],
    [59_999, "01:00"],                       // 올림: 0.001초라도 남으면 아직 0 이 아니다
    [1, "00:01"],
    [3_600_000, "01:00:00"],
    [11_565_000, "03:12:45"],
    [2 * 86_400_000 + 11_565_000, "2일 03:12:45"],
    [0, "00:00"],
    [-5_000, "00:00"],
  ])("%d ms → %s", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe("useNow", () => {
  afterEach(() => jest.useRealTimers());

  test("주기마다 현재 시각으로 갱신된다", () => {
    const start = Date.parse("2026-09-15T10:00:00Z");
    jest.useFakeTimers({ now: start });

    const { result } = renderHook(() => useNow(1000));
    expect(result.current).toBe(start);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(start + 3000);
  });
});
