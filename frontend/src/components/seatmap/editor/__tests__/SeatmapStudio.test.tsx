import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { newRow } from "@/components/seatmap/core/rowGeometry";
import { stubSvgGeometry } from "@/test-utils/svgGeometry";
import SeatmapStudio from "../SeatmapStudio";

const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const section = {
  id: "s1",
  name: "A구역",
  color: "#123456",
  anchors: [anchor("a", 100, 100), anchor("b", 400, 100), anchor("c", 400, 300), anchor("d", 100, 300)],
};
const row = { ...newRow("r1", 3, { x: 250, y: 200 }), name: "A" };

let restore: () => void;
beforeEach(() => {
  restore = stubSvgGeometry();
  server.use(
    http.get(`${BASE_URL}/venues/1/layout`, () =>
      HttpResponse.json({
        seq: 1,
        venueSeq: 1,
        layoutJson: JSON.stringify({ version: 1, sections: [section], rowsBySection: { s1: [row] } }),
      }),
    ),
  );
});
afterEach(() => restore());

/** 섹션을 선택하고 "좌석 편집 →" 으로 줄 에디터에 들어간다. */
async function enterRowEditor() {
  const user = userEvent.setup();
  const { container } = render(<SeatmapStudio venueSeq={1} />);
  await screen.findByText("섹션 1개 · 좌석 3석");
  await user.click(screen.getByRole("button", { name: "선택" }));
  const body = container.querySelector(`path[fill="${section.color}"]`)!;
  fireEvent.pointerDown(body, { clientX: 150, clientY: 150, button: 0, pointerId: 1 });
  fireEvent.pointerUp(container.querySelector("svg")!, { clientX: 150, clientY: 150, pointerId: 1 });
  await user.click(screen.getByRole("button", { name: "좌석 편집 →" }));
  return { user, container };
}

test("줄 에디터에서 Delete 를 눌러도 숨겨진 섹션 에디터가 섹션을 지우지 않는다", async () => {
  const { user } = await enterRowEditor();
  fireEvent.keyDown(window, { key: "Delete" });
  await user.click(screen.getByRole("button", { name: "← 섹션" }));
  expect(screen.getByText(/^섹션 1개/)).toBeInTheDocument();
});

test("줄 에디터에서 바꾼 줄이 나가기 전에도 상단 저장 바에 반영된다", async () => {
  const { user } = await enterRowEditor();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  expect(screen.getByText("섹션 1개 · 좌석 13석")).toBeInTheDocument();
  expect(screen.getByText("A구역: 이름 없는 줄 1개")).toBeInTheDocument();
});
