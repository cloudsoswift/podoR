import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { enterQueue, leaveQueue, leaveQueueKeepalive, QueueStatusResponse } from "@/lib/api/queue";
import { notifyQueuePassLost } from "@/lib/queuePassLost";
import QueueGate from "../QueueGate";

jest.mock("@/lib/api/queue", () => ({
  enterQueue: jest.fn(),
  leaveQueue: jest.fn(),
  leaveQueueKeepalive: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockedEnter = enterQueue as jest.MockedFunction<typeof enterQueue>;
const mockedLeave = leaveQueue as jest.MockedFunction<typeof leaveQueue>;
const mockedKeepalive = leaveQueueKeepalive as jest.MockedFunction<typeof leaveQueueKeepalive>;

const NOW = Date.parse("2026-09-15T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const admitted = (expiresInMs = 15 * 60_000): QueueStatusResponse => ({
  status: "ADMITTED",
  passExpiresAt: iso(NOW + expiresInMs),
  opensAt: iso(NOW - 60_000),
});
const waiting = (position: number): QueueStatusResponse => ({
  status: "WAITING",
  position,
  ahead: position - 1,
  opensAt: iso(NOW - 60_000),
});
const notOpen = (opensInMs: number): QueueStatusResponse => ({
  status: "NOT_OPEN",
  opensAt: iso(NOW + opensInMs),
});

function httpError(status: number) {
  return new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

/** 가짜 시계를 진행시키고, 그 사이 풀린 mock promise 와 React 갱신을 흘려보낸다. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** mock promise 해소와 React 갱신만 흘려보낸다. */
async function flush() {
  await act(async () => {});
}

function renderGate() {
  return render(
    <QueueGate eventId="E1">
      <p>좌석 화면</p>
    </QueueGate>,
  );
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  mockedEnter.mockReset();
  mockedLeave.mockReset().mockResolvedValue(undefined);
  mockedKeepalive.mockReset();
  mockPush.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

test("입장권이 있으면 children 과 남은 입장 시간을 보여주고 더 폴링하지 않는다", async () => {
  mockedEnter.mockResolvedValue(admitted(12 * 60_000 + 34_000));

  renderGate();
  await flush();

  expect(screen.getByText("좌석 화면")).toBeInTheDocument();
  expect(screen.getByText("입장 시간 12:34 남음")).toBeInTheDocument();

  await advance(10_000);
  expect(screen.getByText("입장 시간 12:24 남음")).toBeInTheDocument();
  expect(mockedEnter).toHaveBeenCalledTimes(1);
});

test("대기 중이면 순번과 새로고침 안내를 보여주고, 입장되면 children 으로 바뀐다", async () => {
  mockedEnter.mockResolvedValueOnce(waiting(42)).mockResolvedValueOnce(admitted());

  renderGate();
  await flush();

  expect(screen.getByText("입장 대기 중")).toBeInTheDocument();
  expect(screen.getByText("42번")).toBeInTheDocument();
  expect(screen.getByText("내 앞에 41명")).toBeInTheDocument();
  expect(screen.getByText("새로고침하거나 창을 닫으면 순번이 뒤로 밀립니다.")).toBeInTheDocument();
  expect(screen.queryByText("좌석 화면")).not.toBeInTheDocument();

  await advance(2500); // 폴링 = 하트비트

  expect(screen.getByText("좌석 화면")).toBeInTheDocument();
  expect(mockedEnter).toHaveBeenCalledTimes(2);
});

test("대기 중 폴링이 일시적으로 실패해도 대기 화면을 유지하고 다음 주기에 재시도한다", async () => {
  mockedEnter
    .mockResolvedValueOnce(waiting(3))
    .mockRejectedValueOnce(httpError(500))
    .mockResolvedValueOnce(waiting(2));

  renderGate();
  await flush();
  expect(screen.getByText("3번")).toBeInTheDocument();

  await advance(2500);
  expect(screen.getByText("3번")).toBeInTheDocument();
  expect(screen.queryByText("대기열 정보를 불러오지 못했습니다.")).not.toBeInTheDocument();

  await advance(2500);
  expect(screen.getByText("2번")).toBeInTheDocument();
  expect(mockedEnter).toHaveBeenCalledTimes(3);
});

test("오픈 전이면 카운트다운을 보여주고, 오픈 시각에 다시 확인하며, 서버가 아직이라면 1초 뒤 재시도한다", async () => {
  mockedEnter
    .mockResolvedValueOnce(notOpen(5000))
    .mockResolvedValueOnce(notOpen(5000)) // 클라이언트 시계가 빨라서 서버는 아직 오픈 전
    .mockResolvedValueOnce(admitted());

  renderGate();
  await flush();
  expect(screen.getByText("예매 오픈까지")).toBeInTheDocument();
  expect(screen.getByText("00:05")).toBeInTheDocument();

  await advance(4999);
  expect(mockedEnter).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(mockedEnter).toHaveBeenCalledTimes(2);

  await advance(999);
  expect(mockedEnter).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(mockedEnter).toHaveBeenCalledTimes(3);
  expect(screen.getByText("좌석 화면")).toBeInTheDocument();
});

test("오픈이 한 달 뒤여도 setTimeout 상한을 넘겨 즉시 재요청하지 않는다", async () => {
  mockedEnter.mockResolvedValue(notOpen(40 * 86_400_000));

  renderGate();
  await flush();
  await advance(5000);

  expect(mockedEnter).toHaveBeenCalledTimes(1);
});

test("입장 시간이 끝나면 children 을 내리고 다시 줄을 선다", async () => {
  mockedEnter.mockResolvedValueOnce(admitted(3000)).mockResolvedValueOnce(waiting(1));

  renderGate();
  await flush();
  expect(screen.getByText("좌석 화면")).toBeInTheDocument();

  await advance(3000);

  expect(screen.queryByText("좌석 화면")).not.toBeInTheDocument();
  expect(screen.getByText("1번")).toBeInTheDocument();
  expect(mockedEnter).toHaveBeenCalledTimes(2);
});

test("최초 입장 요청이 실패하면(404 등) 오류 화면을 보여준다", async () => {
  mockedEnter.mockRejectedValue(httpError(404));

  renderGate();
  await flush();

  expect(screen.getByText("대기열 정보를 불러오지 못했습니다.")).toBeInTheDocument();
});

test("401 은 오류 화면으로 바꾸지 않는다 — 인터셉터가 로그인 페이지로 보내는 중이다", async () => {
  mockedEnter.mockRejectedValue(httpError(401));

  renderGate();
  await flush();

  expect(screen.getByText("입장 확인 중…")).toBeInTheDocument();
  expect(screen.queryByText("대기열 정보를 불러오지 못했습니다.")).not.toBeInTheDocument();
});

test("좌측 상단 뒤로가기를 누르면 이벤트 상세로 이동한다", async () => {
  mockedEnter.mockResolvedValue(waiting(5));
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  renderGate();
  await flush();
  await user.click(screen.getByRole("button", { name: "← 뒤로" }));

  expect(mockPush).toHaveBeenCalledWith("/events/E1");
});

describe("입장권 상실(403) 수신", () => {
  test("같은 이벤트의 403 알림이면 children 을 내리고 다시 줄을 선다", async () => {
    mockedEnter.mockResolvedValueOnce(admitted()).mockResolvedValueOnce(waiting(7));

    renderGate();
    await flush();
    expect(screen.getByText("좌석 화면")).toBeInTheDocument();

    await act(async () => {
      notifyQueuePassLost("E1");
    });
    await flush();

    // children 이 내려가므로 좌석 폴링의 403 반복도 함께 멈춘다
    expect(screen.queryByText("좌석 화면")).not.toBeInTheDocument();
    expect(screen.getByText("7번")).toBeInTheDocument();
    expect(mockedEnter).toHaveBeenCalledTimes(2);
  });

  test("다른 이벤트의 403 알림은 무시한다", async () => {
    mockedEnter.mockResolvedValue(admitted());

    renderGate();
    await flush();
    await act(async () => {
      notifyQueuePassLost("OTHER");
    });
    await flush();

    expect(screen.getByText("좌석 화면")).toBeInTheDocument();
    expect(mockedEnter).toHaveBeenCalledTimes(1);
  });
});

describe("반납", () => {
  test("언마운트되면 잠시 뒤 반납한다", async () => {
    mockedEnter.mockResolvedValue(admitted());
    const { unmount } = renderGate();
    await flush();

    unmount();
    await advance(99);
    expect(mockedLeave).not.toHaveBeenCalled();
    await advance(1);
    expect(mockedLeave).toHaveBeenCalledWith("E1");
  });

  test("StrictMode 의 mount → cleanup → mount 에서는 반납하지 않는다", async () => {
    mockedEnter.mockResolvedValue(admitted());

    render(
      <StrictMode>
        <QueueGate eventId="E1">
          <p>좌석 화면</p>
        </QueueGate>
      </StrictMode>,
    );
    await flush();
    await advance(1000);

    expect(mockedLeave).not.toHaveBeenCalled();
    expect(screen.getByText("좌석 화면")).toBeInTheDocument();
  });

  test("다른 이벤트로 바뀌면 이전 이벤트의 자리를 반납한다", async () => {
    mockedEnter.mockResolvedValue(admitted());
    const { rerender } = renderGate();
    await flush();

    rerender(
      <QueueGate eventId="E2">
        <p>좌석 화면</p>
      </QueueGate>,
    );
    await advance(100);

    expect(mockedLeave).toHaveBeenCalledWith("E1");
    expect(mockedLeave).not.toHaveBeenCalledWith("E2");
  });

  test("탭 닫기·새로고침(pagehide)이면 keepalive 로 반납한다", async () => {
    mockedEnter.mockResolvedValue(waiting(3));
    renderGate();
    await flush();

    window.dispatchEvent(new Event("pagehide"));

    expect(mockedKeepalive).toHaveBeenCalledWith("E1");
  });
});
