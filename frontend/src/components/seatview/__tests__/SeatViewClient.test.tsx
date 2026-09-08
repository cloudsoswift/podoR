import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { SeatViewSeat } from "@/lib/api/seatview";
import SeatViewClient from "../SeatViewClient";
import { useSeatViewPolling } from "../useSeatViewPolling";

// 폴링 훅은 HTTP 가 아니라 내부 모듈이므로 jest.mock 으로 대체한다.
// (2.5초 폴링 타이머를 회피하고 seats/heldSeats 를 직접 주입하기 위함)
jest.mock("../useSeatViewPolling", () => ({ useSeatViewPolling: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockedPolling = useSeatViewPolling as jest.MockedFunction<typeof useSeatViewPolling>;

const SECTION = "A구역";
const layoutJson = JSON.stringify([{ id: "s1", name: SECTION, color: "#000000" }]);

const seat = (seq: number, seatNumber: number): SeatViewSeat => ({
  eventSeatSeq: seq,
  section: SECTION,
  rowNumber: "A",
  seatNumber,
  grade: "VIP",
  price: 10000,
  status: "AVAILABLE",
  changeVersion: 0,
});

const seats = [seat(1, 1), seat(2, 2), seat(3, 3)];

/** 훅 반환값 설정. refresh 는 호출 검증용 jest.fn. */
function setupPolling(refresh = jest.fn()) {
  mockedPolling.mockReturnValue({ seats, layoutJson, heldSeats: [], loading: false, refresh });
  return refresh;
}

/** my-seat-quota 응답 지정. */
function stubQuota(used: number, max: number) {
  server.use(
    http.get("http://localhost:8080/events/E1/my-seat-quota", () =>
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
  await user.click(screen.getByTitle(/^A1 ·/));
  expect(screen.getByText("선택 1석")).toBeInTheDocument();

  // 두 번째는 거부되고 안내가 뜬다
  await user.click(screen.getByTitle(/^A2 ·/));
  expect(window.alert).toHaveBeenCalledWith("이 공연은 1인 최대 4석까지 예매할 수 있습니다.");
  expect(screen.getByText("선택 1석")).toBeInTheDocument();
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
