import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { SeatViewSeat } from "@/lib/api/seatview";
import SeatViewClient from "../SeatViewClient";
import { useSeatViewPolling } from "../useSeatViewPolling";

// 폴링 훅은 HTTP 가 아니라 내부 모듈이므로 jest.mock 으로 대체한다.
// (2.5초 폴링 타이머를 회피하고 seats/heldSeats 를 직접 주입하기 위함)
jest.mock("../useSeatViewPolling", () => ({ useSeatViewPolling: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockedPolling = useSeatViewPolling as jest.MockedFunction<typeof useSeatViewPolling>;

const SECTION = "A구역";
// 에디터가 저장하는 SeatmapDoc: 사각형 섹션 1개 + 1행 4석(4번은 에디터에서 '사용 안 함').
const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const layoutSeat = (number: number, available = true) => ({
  id: `seat-${number}`,
  x: number * 20,
  y: 20,
  gridRow: 0,
  number,
  available,
});
const layoutJson = JSON.stringify({
  version: 1,
  sections: [
    {
      id: "s1",
      name: SECTION,
      color: "#000000",
      anchors: [anchor("a1", 0, 0), anchor("a2", 100, 0), anchor("a3", 100, 40), anchor("a4", 0, 40)],
    },
  ],
  seatsBySection: { s1: [layoutSeat(1), layoutSeat(2), layoutSeat(3), layoutSeat(4, false)] },
});

const seat = (seq: number, seatNumber: number, status: SeatViewSeat["status"] = "AVAILABLE"): SeatViewSeat => ({
  eventSeatSeq: seq,
  section: SECTION,
  rowNumber: "A",
  seatNumber,
  grade: "VIP",
  price: 10000,
  status,
  changeVersion: 0,
});

const seats = [seat(1, 1), seat(2, 2), seat(3, 3)];

/** 훅 반환값 설정. refresh 는 호출 검증용 jest.fn. */
function setupPolling(
  refresh = jest.fn(),
  opts: { seats?: SeatViewSeat[]; heldSeats?: number[]; layoutJson?: string } = {},
) {
  mockedPolling.mockReturnValue({
    seats: opts.seats ?? seats,
    layoutJson: opts.layoutJson ?? layoutJson,
    heldSeats: opts.heldSeats ?? [],
    loading: false,
    refresh,
  });
  return refresh;
}

/** 좌석 맵의 좌석(SVG circle, role=button). */
const seatButton = (name: string) => screen.getByRole("button", { name });

/** my-seat-quota 응답 지정. */
function stubQuota(used: number, max: number) {
  server.use(
    http.get(`${BASE_URL}/events/E1/my-seat-quota`, () =>
      HttpResponse.json({ used, max }),
    ),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.alert = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

test("quota 카운터가 섹션 선택·좌석 선택 두 단계 모두 표시된다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(2, 4);

  render(<SeatViewClient eventId="E1" />);

  // 1단계: 섹션 선택
  expect(await screen.findByText("현재 2 / 4")).toBeInTheDocument();
  expect(screen.getByText("섹션 선택")).toBeInTheDocument();

  // 2단계: 좌석 선택으로 진입해도 계속 표시
  await user.click(screen.getByRole("button", { name: /A구역/ }));
  expect(screen.getByText("현재 2 / 4")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
});

test("남은 할당량을 초과하면 좌석이 더 선택되지 않고 안내가 뜬다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(3, 4); // 잔여 1석

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 3 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  // 잔여 1석 → 첫 좌석은 선택된다
  await user.click(seatButton("A열 1번 · VIP"));
  expect(screen.getByText("선택 1석")).toBeInTheDocument();

  // 두 번째는 거부되고 안내가 뜬다
  await user.click(seatButton("A열 2번 · VIP"));
  expect(window.alert).toHaveBeenCalledWith("이 공연은 1인 최대 4석까지 예매할 수 있습니다.");
  expect(screen.getByText("선택 1석")).toBeInTheDocument();
});

test("선점에 성공하면 선택을 비워 결제 바에 갇히지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);
  server.use(
    http.post(`${BASE_URL}/events/E1/holds`, () =>
      HttpResponse.json({ heldSeats: [1], expiresAt: "2026-01-01T00:00:00" }),
    ),
  );

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));
  await user.click(seatButton("A열 1번 · VIP"));
  expect(screen.getByText("선택 1석")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "결제하기" }));

  // 선점된 좌석은 클릭 불가가 되므로, 선택이 남아 있으면 해제할 방법이 없다.
  await waitFor(() => expect(screen.queryByText("선택 1석")).not.toBeInTheDocument());
});

test("선점 실패 시 서버가 보낸 사유를 그대로 안내한다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);
  server.use(
    http.post(`${BASE_URL}/events/E1/holds`, () =>
      HttpResponse.json(
        { status: 409, title: "Conflict", detail: "이 공연은 1인 최대 4석까지 예매할 수 있습니다." },
        { status: 409 },
      ),
    ),
  );

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));
  await user.click(seatButton("A열 1번 · VIP"));
  await user.click(screen.getByRole("button", { name: "결제하기" }));

  await waitFor(() =>
    expect(window.alert).toHaveBeenCalledWith("이 공연은 1인 최대 4석까지 예매할 수 있습니다."),
  );
});

test("선점 요청 중에는 결제하기가 중복 호출되지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);
  let holdCalls = 0;
  server.use(
    http.post(`${BASE_URL}/events/E1/holds`, async () => {
      holdCalls += 1;
      await delay(50); // 진행 중 상태를 만들기 위해 지연
      return HttpResponse.json({ heldSeats: [1], expiresAt: "2026-01-01T00:00:00" });
    }),
  );

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));
  await user.click(seatButton("A열 1번 · VIP"));

  const pay = screen.getByRole("button", { name: "결제하기" });
  await user.click(pay);
  // 진행 중에는 비활성이라 추가 클릭이 먹지 않는다
  expect(screen.getByRole("button", { name: "처리 중…" })).toBeDisabled();

  await waitFor(() => expect(holdCalls).toBe(1));
});

test("새로고침 버튼은 쿨다운 동안 비활성이고 연타를 무시한다", async () => {
  const refresh = setupPolling();
  stubQuota(0, 4);

  // 1단계는 실제 타이머로 — fake timer 아래에서는 MSW 응답이 도착하지 못한다.
  const realUser = userEvent.setup();
  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await realUser.click(screen.getByRole("button", { name: /A구역/ }));

  // quota 가 정착한 뒤부터 쿨다운(3초)만 가짜 타이머로 제어한다.
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  await user.click(screen.getByRole("button", { name: "새로고침" }));
  expect(refresh).toHaveBeenCalledTimes(1);

  // 쿨다운 중: 비활성 + 추가 호출 없음
  const cooling = screen.getByRole("button", { name: "새로고침 대기…" });
  expect(cooling).toBeDisabled();
  await user.click(cooling);
  expect(refresh).toHaveBeenCalledTimes(1);

  // 3초 경과 후 재활성
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByRole("button", { name: "새로고침" })).toBeEnabled();

  // 새로고침이 함께 호출한 quota 재조회가 fake timer 에 걸려 있다.
  // 실제 타이머로 되돌려 테스트 안에서 정착시킨다(테스트 종료 후 setState 방지).
  jest.useRealTimers();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});

test("판매하지 않는 좌석은 그려지지만 선택되지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  const unsold = seatButton("A열 4번");
  expect(unsold).toHaveAttribute("aria-disabled", "true");
  await user.click(unsold);
  expect(screen.queryByText(/선택 \d+석/)).not.toBeInTheDocument();
});

test("선점중·판매완료 좌석은 선택되지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling(jest.fn(), { seats: [seat(1, 1), seat(2, 2), seat(3, 3, "SOLD")], heldSeats: [2] });
  stubQuota(0, 4);

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  await user.click(seatButton("A열 2번 · VIP"));
  await user.click(seatButton("A열 3번 · VIP"));
  expect(screen.queryByRole("button", { name: "결제하기" })).not.toBeInTheDocument();
});

test("매진 섹션도 진입할 수 있다", async () => {
  const user = userEvent.setup();
  setupPolling(jest.fn(), { seats: [seat(1, 1, "SOLD"), seat(2, 2, "SOLD"), seat(3, 3, "SOLD")] });
  stubQuota(0, 4);

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  const entry = screen.getByRole("button", { name: /A구역/ });
  expect(entry).toBeEnabled();
  await user.click(entry);

  expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
  for (const name of ["A열 1번 · VIP", "A열 2번 · VIP", "A열 3번 · VIP", "A열 4번"]) {
    expect(seatButton(name)).toHaveAttribute("aria-disabled", "true");
  }
});

test("좌석 툴팁에 가격이 없다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  const { container } = render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  const titles = [...container.querySelectorAll("circle > title")].map((t) => t.textContent);
  expect(titles).toHaveLength(4);
  for (const t of titles) expect(t).not.toMatch(/원/);
});

test("드래그로 팬한 뒤에는 좌석이 선택되지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  const { container } = render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  const target = seatButton("A열 1번 · VIP");
  const svg = container.querySelector("svg")!;
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 50, clientY: 0, buttons: 1, pointerId: 1 });
  fireEvent.pointerUp(svg, { clientX: 50, clientY: 0, pointerId: 1 });
  fireEvent.click(target);

  expect(screen.queryByText("선택 1석")).not.toBeInTheDocument();

  // 팬 직후라도 키보드 선택은 막히지 않는다.
  target.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByText("선택 1석")).toBeInTheDocument();
});

test("pointercancel 이 오면 팬이 끝난다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  const { container } = render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  const svg = container.querySelector("svg")!;
  fireEvent.pointerDown(seatButton("A열 1번 · VIP"), { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 50, clientY: 0, buttons: 1, pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grabbing" });

  // 브라우저가 포인터를 가져가면(터치 스크롤 등) pointerup 대신 pointercancel 이 온다.
  fireEvent.pointerCancel(svg, { pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grab" });
});

test("지도 밖에서 버튼을 뗀 뒤 버튼 없이 움직이면 팬하지 않는다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  const { container } = render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  const svg = container.querySelector("svg")!;
  // pointerdown 후 지도 밖에서 떼면 svg 는 pointerup 을 받지 못한다.
  fireEvent.pointerDown(seatButton("A열 1번 · VIP"), { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 50, clientY: 0, buttons: 0, pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grab" });
});

test("좌석 반지름은 layoutJson 에 저장된 간격으로 계산한다", async () => {
  const user = userEvent.setup();
  const withGrid = JSON.stringify({
    ...JSON.parse(layoutJson),
    gridBySection: { s1: { colPitch: 25, rowPitch: 30 } },
  });
  setupPolling(jest.fn(), { layoutJson: withGrid });
  stubQuota(0, 4);

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));

  // 좌표로 추정하면 간격 20 → 반지름 8, 저장된 간격(25,30)이면 min(25,30)*0.4 = 10.
  expect(seatButton("A열 1번 · VIP")).toHaveAttribute("r", "10");
});

test("결제 바에서 선택 좌석 목록을 펼쳐 섹션 맵에서도 확인·취소할 수 있다", async () => {
  const user = userEvent.setup();
  setupPolling();
  stubQuota(0, 4);

  render(<SeatViewClient eventId="E1" />);
  await screen.findByText("현재 0 / 4");
  await user.click(screen.getByRole("button", { name: /A구역/ }));
  await user.click(seatButton("A열 2번 · VIP"));
  await user.click(seatButton("A열 1번 · VIP"));

  // 섹션 맵으로 돌아가도 선택은 유지되고, 목록은 접힌 상태로 시작한다.
  await user.click(screen.getByRole("button", { name: "← 전체 섹션" }));
  const toggle = screen.getByRole("button", { name: "선택 2석" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("A구역(VIP) - A열 - 1번")).not.toBeInTheDocument();

  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const items = screen.getAllByRole("listitem").map((li) => li.textContent);
  // 섹션·행·번호 순으로 정렬된다.
  expect(items).toEqual([
    expect.stringContaining("A구역(VIP) - A열 - 1번"),
    expect.stringContaining("A구역(VIP) - A열 - 2번"),
  ]);

  await user.click(screen.getByRole("button", { name: "A구역(VIP) - A열 - 1번 선택 취소" }));
  expect(screen.queryByText("A구역(VIP) - A열 - 1번")).not.toBeInTheDocument();
  expect(screen.getByText("선택 1석")).toBeInTheDocument();

  // 마지막 좌석을 빼면 결제 바가 사라진다.
  await user.click(screen.getByRole("button", { name: "A구역(VIP) - A열 - 2번 선택 취소" }));
  expect(screen.queryByRole("button", { name: "결제하기" })).not.toBeInTheDocument();
});
