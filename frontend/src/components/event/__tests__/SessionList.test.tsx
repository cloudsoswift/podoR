import { act, render, screen } from "@testing-library/react";
import { EventItem } from "@/lib/api/events";
import { useAuthStore } from "@/store/authStore";
import SessionList from "../SessionList";

const NOW = Date.parse("2026-09-15T10:00:00Z");

const session = (eventId: string, ticketingInMs: number): EventItem => ({
  seq: 1,
  eventId,
  seriesId: "S1",
  title: "공연",
  content: null,
  eventType: "POP",
  eventDate: "2026-10-03T19:00:00",
  ticketingDate: new Date(NOW + ticketingInMs).toISOString(),
  streamStatus: null,
  createdDate: "2026-09-01T00:00:00",
  venueSeq: 1,
  venueName: "공연장",
  hostSeq: 1,
  hostNickname: "host",
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  useAuthStore.getState().clearAuth();
});

afterEach(() => {
  jest.useRealTimers();
});

test("오픈 전에는 링크 없이 남은 시간을 보여주고, 오픈 시각이 되면 예매하기 링크가 된다", () => {
  useAuthStore.getState().setAccessToken("T");

  render(<SessionList sessions={[session("E1", 5000)]} />);

  expect(screen.getByText("예매 오픈까지 00:05")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(5000);
  });

  // 자동으로 이동하지는 않는다 — 버튼만 활성화된다
  expect(screen.getByRole("link", { name: /예매하기/ })).toHaveAttribute("href", "/events/E1/seats");
});

test("로그인하지 않았으면 로그인 후 좌석으로 돌아오는 링크가 된다", () => {
  render(<SessionList sessions={[session("E1", -1000)]} />);

  expect(screen.getByRole("link", { name: /예매하기/ })).toHaveAttribute(
    "href",
    "/login?redirect=%2Fevents%2FE1%2Fseats",
  );
});

test("회차가 없으면 안내 문구를 보여준다", () => {
  render(<SessionList sessions={[]} />);

  expect(screen.getByText("회차 정보가 없습니다.")).toBeInTheDocument();
});
