import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { StreamKey } from "@/lib/api/stream";
import StreamKeyPanel from "../StreamKeyPanel";

const key = (patch: Partial<StreamKey> = {}): StreamKey => ({
  streamKey: "KEY-AAAA",
  rtmpUrl: "rtmp://host/live",
  status: "SCHEDULED",
  vodStatus: "NONE",
  ...patch,
});

function stub(first: StreamKey, reissue?: { status: number; body?: StreamKey }) {
  server.use(
    http.get(`${BASE_URL}/events/E1/stream-key`, () => HttpResponse.json(first)),
    http.post(`${BASE_URL}/events/E1/stream-key/reissue`, () =>
      reissue?.body
        ? HttpResponse.json(reissue.body, { status: reissue.status })
        : new HttpResponse(null, { status: reissue?.status ?? 500 }),
    ),
  );
}

async function renderPanel() {
  await act(async () => {
    render(<StreamKeyPanel eventId="E1" />);
  });
  await screen.findByText("rtmp://host/live");
}

test("키는_기본으로_가려지고_보기를_누르면_보인다", async () => {
  stub(key());
  await renderPanel();

  expect(screen.queryByText("KEY-AAAA")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "보기" }));
  expect(screen.getByText("KEY-AAAA")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "숨기기" }));
  expect(screen.queryByText("KEY-AAAA")).not.toBeInTheDocument();
});

test("복사를_누르면_클립보드에_키", async () => {
  stub(key());
  const user = userEvent.setup();
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  await renderPanel();

  await user.click(screen.getByRole("button", { name: "복사" }));

  expect(writeText).toHaveBeenCalledWith("KEY-AAAA");
});

test("재발급_확인하면_새_키로_바뀐다", async () => {
  stub(key(), { status: 200, body: key({ streamKey: "KEY-BBBB" }) });
  await renderPanel();

  await userEvent.click(screen.getByRole("button", { name: "재발급" }));
  await userEvent.click(screen.getByRole("button", { name: "재발급하기" }));
  await userEvent.click(await screen.findByRole("button", { name: "보기" }));

  expect(await screen.findByText("KEY-BBBB")).toBeInTheDocument();
});

test("재발급_409_면_안내", async () => {
  stub(key(), { status: 409 });
  await renderPanel();

  await userEvent.click(screen.getByRole("button", { name: "재발급" }));
  await userEvent.click(screen.getByRole("button", { name: "재발급하기" }));

  expect(await screen.findByText("방송 중에는 재발급할 수 없습니다.")).toBeInTheDocument();
});

test("SCHEDULED_에서는_방송_종료_버튼이_없다", async () => {
  stub(key());
  await renderPanel();

  expect(screen.getByText("송출 전")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "방송 종료" })).not.toBeInTheDocument();
});

test("LIVE_에서_종료하면_OBS_중지_안내", async () => {
  stub(key({ status: "LIVE" }));
  let ended = 0;
  server.use(
    http.post(`${BASE_URL}/events/E1/stream/end`, () => {
      ended++;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await renderPanel();

  expect(screen.getByText("방송 중")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "방송 종료" }));
  await userEvent.click(screen.getByRole("button", { name: "종료하기" }));

  expect(await screen.findByText("OBS 에서 방송 중지를 누르면 VOD 를 만듭니다.")).toBeInTheDocument();
  expect(ended).toBe(1);
});

test("ENDED_면_VOD_상태를_보여준다", async () => {
  stub(key({ status: "ENDED", vodStatus: "PROCESSING" }));
  await renderPanel();

  expect(screen.getByText("VOD 만드는 중")).toBeInTheDocument();
});

test("ENDED_가_아니면_VOD_상태를_숨긴다", async () => {
  stub(key({ status: "LIVE", vodStatus: "NONE" }));
  await renderPanel();

  expect(screen.queryByText(/VOD 준비 전/)).not.toBeInTheDocument();
});

test("비트레이트는_10000_Kbps_CBR_로_안내한다", async () => {
  stub(key());
  await renderPanel();

  expect(screen.getByText(/10000 Kbps/)).toBeInTheDocument();
  expect(screen.getByText(/CBR/)).toBeInTheDocument();
});

/** GET 호출 수를 세면서 렌더하고, ms 만큼 시간을 흘린 뒤 호출 수를 돌려준다. */
async function countPolls(data: StreamKey, ms: number): Promise<number> {
  let calls = 0;
  server.use(
    http.get(`${BASE_URL}/events/E1/stream-key`, () => {
      calls++;
      return HttpResponse.json(data);
    }),
  );
  jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick"] });
  try {
    await act(async () => {
      render(<StreamKeyPanel eventId="E1" />);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
    return calls;
  } finally {
    jest.useRealTimers();
  }
}

test("VOD_READY_면_폴링을_멈춘다", async () => {
  expect(await countPolls(key({ status: "ENDED", vodStatus: "READY" }), 15000)).toBe(1);
});

test("VOD_FAILED_면_폴링을_멈춘다", async () => {
  expect(await countPolls(key({ status: "ENDED", vodStatus: "FAILED" }), 15000)).toBe(1);
});

test("ENDED_PROCESSING_이면_폴링을_계속한다", async () => {
  expect(await countPolls(key({ status: "ENDED", vodStatus: "PROCESSING" }), 5000)).toBe(2);
});
