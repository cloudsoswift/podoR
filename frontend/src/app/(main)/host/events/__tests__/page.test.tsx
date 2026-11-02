import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { EventItem } from "@/lib/api/events";
import { useAuthStore } from "@/store/authStore";
import HostEventsPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const ev = (eventId: string, title: string): EventItem => ({
  seq: 1,
  eventId,
  seriesId: "S1",
  title,
  content: null,
  eventType: "CONCERT",
  eventDate: "2026-12-01T19:00:00",
  ticketingDate: "2026-11-20T10:00:00",
  streamStatus: "SCHEDULED",
  createdDate: "2026-11-01T10:00:00",
  venueSeq: 1,
  venueName: "올림픽홀",
  hostSeq: 1,
  hostNickname: "호스트",
});

function stub(lists: EventItem[][]) {
  let call = 0;
  const created: unknown[] = [];
  server.use(
    http.get(`${BASE_URL}/users/me`, () =>
      HttpResponse.json({ email: "h@t.com", nickname: "호스트", profileImage: null, role: "HOST" }),
    ),
    http.get(`${BASE_URL}/users/me/hosted-events`, () =>
      HttpResponse.json(lists[Math.min(call++, lists.length - 1)]),
    ),
    http.post(`${BASE_URL}/events`, async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json(ev("E2", "새 공연"), { status: 201 });
    }),
  );
  return created;
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: "token", user: null });
});

async function renderPage() {
  await act(async () => {
    render(<HostEventsPage />);
  });
}

test("내_회차_목록과_송출_관리_링크", async () => {
  stub([[ev("E1", "봄 콘서트")]]);
  await renderPage();

  const row = (await screen.findByText("봄 콘서트")).closest("li")!;
  expect(within(row).getByRole("link", { name: "송출 관리" })).toHaveAttribute(
    "href",
    "/host/events/E1/stream",
  );
});

test("회차_등록_후_목록_갱신", async () => {
  const created = stub([[ev("E1", "봄 콘서트")], [ev("E1", "봄 콘서트"), ev("E2", "새 공연")]]);
  await renderPage();
  await screen.findByText("봄 콘서트");

  await userEvent.click(screen.getByRole("button", { name: "회차 등록" }));
  const dialog = screen.getByText("이벤트 생성").closest("div")!;
  const inputs = dialog.querySelectorAll("input");
  await userEvent.type(inputs[0], "새 공연"); // 제목
  await userEvent.type(inputs[1], "CONCERT"); // 유형
  // 공연장 선택은 검색 창이 보내는 메시지로 한다
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "venue-picked", seq: 1, name: "올림픽홀" },
        origin: window.location.origin,
      }),
    );
  });
  const dates = dialog.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(dates[0], { target: { value: "2026-12-01T19:00" } });
  fireEvent.change(dates[1], { target: { value: "2026-11-20T10:00" } });
  await userEvent.click(screen.getByRole("button", { name: "저장" }));

  expect(await screen.findByText("새 공연")).toBeInTheDocument();
  expect(created).toHaveLength(1);
});
