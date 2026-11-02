import { act, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { StreamView } from "@/lib/api/stream";
import StreamViewer from "../StreamViewer";

// hls.js 는 MediaSource 가 필요해 jsdom 에서 돌지 않는다. 인스턴스 호출만 기록한다.
type Inst = {
  loadSource: jest.Mock;
  attachMedia: jest.Mock;
  destroy: jest.Mock;
  on: jest.Mock;
  handlers: Record<string, (event: string, data: { fatal: boolean }) => void>;
};
const instances: Inst[] = [];
jest.mock("hls.js", () => {
  const Hls = jest.fn().mockImplementation(() => {
    const inst: Inst = {
      loadSource: jest.fn(),
      attachMedia: jest.fn(),
      destroy: jest.fn(),
      handlers: {},
      on: jest.fn(),
    };
    inst.on.mockImplementation((event: string, cb: Inst["handlers"][string]) => {
      inst.handlers[event] = cb;
    });
    instances.push(inst);
    return inst;
  });
  Object.assign(Hls, { isSupported: () => true, Events: { ERROR: "hlsError" } });
  return { __esModule: true, default: Hls };
});

const view = (patch: Partial<StreamView> = {}): StreamView => ({
  status: "SCHEDULED",
  vodStatus: "NONE",
  liveUrl: null,
  vodUrl: null,
  ...patch,
});

/** 호출마다 views 의 다음 값(마지막 값 유지). */
function stub(views: StreamView[]) {
  let call = 0;
  server.use(
    http.get(`${BASE_URL}/events/E1/stream`, () => HttpResponse.json(views[Math.min(call++, views.length - 1)])),
  );
}

async function renderViewer() {
  await act(async () => {
    render(<StreamViewer eventId="E1" />);
  });
}

beforeEach(() => {
  instances.length = 0;
});

test("SCHEDULED_면_방송_준비중", async () => {
  stub([view()]);
  await renderViewer();
  expect(await screen.findByText("방송 준비중입니다.")).toBeInTheDocument();
});

test("403_이면_예매자_안내", async () => {
  server.use(http.get(`${BASE_URL}/events/E1/stream`, () => new HttpResponse(null, { status: 403 })));
  await renderViewer();
  expect(await screen.findByText("예매한 관객만 볼 수 있습니다.")).toBeInTheDocument();
});

test("LIVE_면_hls_에_liveUrl_을_넘긴다", async () => {
  stub([view({ status: "LIVE", liveUrl: "/media/hls/E1/1/master.m3u8" })]);
  await renderViewer();

  await screen.findByTestId("live-video");
  await act(async () => {});
  expect(instances).toHaveLength(1);
  expect(instances[0].loadSource).toHaveBeenCalledWith("/media/hls/E1/1/master.m3u8");
  expect(instances[0].attachMedia).toHaveBeenCalled();
});

test("세션이_바뀌면_이전_인스턴스를_destroy_하고_새_주소로", async () => {
  jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick"] });
  try {
    stub([
      view({ status: "LIVE", liveUrl: "/media/hls/E1/1/master.m3u8" }),
      view({ status: "LIVE", liveUrl: "/media/hls/E1/2/master.m3u8" }),
    ]);
    await renderViewer();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(instances).toHaveLength(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(instances[0].destroy).toHaveBeenCalled();
    expect(instances).toHaveLength(2);
    expect(instances[1].loadSource).toHaveBeenCalledWith("/media/hls/E1/2/master.m3u8");
  } finally {
    jest.useRealTimers();
  }
});

test("치명적_오류가_나면_잠시_뒤_같은_주소로_다시_붙는다", async () => {
  // 방송 시작 직후에는 ffmpeg 가 master.m3u8 을 아직 안 써서 404 가 난다 — 그대로 멈추면 안 된다.
  jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick"] });
  try {
    stub([view({ status: "LIVE", liveUrl: "/media/hls/E1/1/master.m3u8" })]);
    await renderViewer();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(instances).toHaveLength(1);

    act(() => {
      instances[0].handlers["hlsError"]("hlsError", { fatal: true });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(instances[0].destroy).toHaveBeenCalled();
    expect(instances).toHaveLength(2);
    expect(instances[1].loadSource).toHaveBeenCalledWith("/media/hls/E1/1/master.m3u8");
  } finally {
    jest.useRealTimers();
  }
});

test("INTERRUPTED_면_중단_안내", async () => {
  stub([view({ status: "INTERRUPTED" })]);
  await renderViewer();
  expect(await screen.findByText("방송이 잠시 중단되었습니다.")).toBeInTheDocument();
});

test("ENDED_PROCESSING_이면_VOD_준비중", async () => {
  stub([view({ status: "ENDED", vodStatus: "PROCESSING" })]);
  await renderViewer();
  expect(await screen.findByText("VOD 준비중입니다.")).toBeInTheDocument();
});

test("ENDED_NONE_도_VOD_준비중", async () => {
  stub([view({ status: "ENDED", vodStatus: "NONE" })]);
  await renderViewer();
  expect(await screen.findByText("VOD 준비중입니다.")).toBeInTheDocument();
});

test("ENDED_READY_면_video_src_가_vodUrl", async () => {
  stub([view({ status: "ENDED", vodStatus: "READY", vodUrl: "/media/vod/E1.mp4" })]);
  await renderViewer();
  const video = await screen.findByTestId("vod-video");
  expect(video).toHaveAttribute("src", "/media/vod/E1.mp4");
});

test("FAILED_면_실패_안내", async () => {
  stub([view({ status: "ENDED", vodStatus: "FAILED" })]);
  await renderViewer();
  expect(await screen.findByText("VOD 를 준비하지 못했습니다.")).toBeInTheDocument();
});
