import { useReducer } from "react";
import { fireEvent, render } from "@testing-library/react";
import { newRow } from "@/components/seatmap/core/rowGeometry";
import { RowEditorMode, SeatRow } from "@/components/seatmap/core/seatTypes";
import { BackgroundImage, Section } from "@/components/seatmap/core/types";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { stubSvgGeometry } from "@/test-utils/svgGeometry";
import RowCanvas from "../RowCanvas";
import { createRowEditorState, rowEditorReducer } from "../rowEditorReducer";

const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
// (0,0)–(400,300) 사각형 섹션.
const section: Section = {
  id: "s1",
  name: "A구역",
  color: "#4f46e5",
  anchors: [anchor("a", 0, 0), anchor("b", 400, 0), anchor("c", 400, 300), anchor("d", 0, 300)],
};
const r1 = { ...newRow("r1", 3, { x: 100, y: 100 }), name: "A" };
const r2 = { ...newRow("r2", 3, { x: 100, y: 200 }), name: "B" };

function Harness({
  rows,
  mode = "row",
  background = null,
}: {
  rows: SeatRow[];
  mode?: RowEditorMode;
  background?: BackgroundImage | null;
}) {
  const [state, dispatch] = useReducer(rowEditorReducer, undefined, () => ({
    ...createRowEditorState(section, rows),
    mode,
  }));
  const pz = usePanZoom();
  return <RowCanvas pz={pz} state={state} dispatch={dispatch} background={background} />;
}

let restore: () => void;
beforeEach(() => {
  restore = stubSvgGeometry();
});
afterEach(() => restore());

function setup(props: Parameters<typeof Harness>[0]) {
  const utils = render(<Harness {...props} />);
  const svg = utils.container.querySelector("svg")!;
  const at = (x: number, y: number, extra: object = {}) => ({ clientX: x, clientY: y, pointerId: 1, ...extra });
  const drag = (from: [number, number], to: [number, number], extra: object = {}) => {
    fireEvent.pointerDown(svg, at(...from, { button: 0, ...extra }));
    fireEvent.pointerMove(svg, at(...to, { buttons: 1 }));
    fireEvent.pointerUp(svg, at(...to));
  };
  const click = (x: number, y: number, extra: object = {}) => drag([x, y], [x, y], extra);
  const rowEl = (id: string) => utils.container.querySelector(`[data-row-id="${id}"]`)!;
  const seatG = (key: string) => utils.container.querySelector(`[data-seat-key="${key}"]`)!;
  const seat = (key: string) => seatG(key).querySelector("circle")!;
  const rowIds = () => [...utils.container.querySelectorAll("[data-row-id]")].map((g) => g.getAttribute("data-row-id"));
  return { ...utils, svg, at, drag, click, rowEl, seatG, seat, rowIds };
}

test("줄과 좌석을 그린다", () => {
  const { rowIds, container } = setup({ rows: [r1, r2] });
  expect(rowIds()).toEqual(["r1", "r2"]);
  expect(container.querySelectorAll("[data-seat-key] circle")).toHaveLength(6);
});

test("줄 클릭으로 선택, Shift+클릭으로 추가 선택", () => {
  const { click, rowEl } = setup({ rows: [r1, r2] });
  click(80, 100);
  expect(rowEl("r1")).toHaveAttribute("data-selected", "true");
  expect(rowEl("r2")).toHaveAttribute("data-selected", "false");
  click(80, 200, { shiftKey: true });
  expect(rowEl("r1")).toHaveAttribute("data-selected", "true");
  expect(rowEl("r2")).toHaveAttribute("data-selected", "true");
});

test("줄 몸통 드래그로 이동", () => {
  const { drag, seat } = setup({ rows: [r1, r2] });
  drag([80, 100], [110, 100]);
  expect(seat("r1#0")).toHaveAttribute("cx", "110");
  expect(seat("r2#0")).toHaveAttribute("cx", "80");
});

test("Ctrl+드래그로 복제본을 끌어 놓는다", () => {
  const { drag, seat, rowIds, rowEl } = setup({ rows: [r1, r2] });
  drag([80, 100], [80, 150], { ctrlKey: true });
  const ids = rowIds();
  expect(ids).toHaveLength(3);
  expect(seat("r1#0")).toHaveAttribute("cy", "100");
  const copy = ids[2]!;
  expect(seat(`${copy}#0`)).toHaveAttribute("cy", "150");
  expect(rowEl(copy)).toHaveAttribute("data-selected", "true");
  expect(rowEl("r1")).toHaveAttribute("data-selected", "false");
});

test("빈 곳 드래그(마퀴)로 좌석이 들어온 줄만 선택", () => {
  const { drag, rowEl } = setup({ rows: [r1, r2] });
  drag([300, 20], [390, 290]);
  expect(rowEl("r1")).toHaveAttribute("data-selected", "false");
  drag([50, 80], [150, 120]);
  expect(rowEl("r1")).toHaveAttribute("data-selected", "true");
  expect(rowEl("r2")).toHaveAttribute("data-selected", "false");
});

test("좌석 모드: 클릭으로 사용 여부 토글, 줄은 움직이지 않는다", () => {
  const { click, drag, seat } = setup({ rows: [r1, r2], mode: "seat" });
  click(100, 100);
  expect(seat("r1#1")).toHaveAttribute("fill", "#f3f4f6");
  drag([100, 100], [140, 100]);
  expect(seat("r1#1")).toHaveAttribute("cx", "100");
});

test("좌석 모드: 마퀴로 좌석 선택", () => {
  const { drag, seat } = setup({ rows: [r1, r2], mode: "seat" });
  drag([70, 90], [110, 110]);
  expect(seat("r1#0")).toHaveAttribute("stroke", "#111827");
  expect(seat("r1#1")).toHaveAttribute("stroke", "#111827");
  expect(seat("r1#2")).not.toHaveAttribute("stroke", "#111827");
});

test("겹침·섹션 밖·이름 없는 줄을 표시한다", () => {
  const edge = { ...newRow("edge", 3, { x: 375, y: 250 }), name: "E" };
  const unnamed = newRow("u", 2, { x: 200, y: 50 });
  const { seatG, rowEl } = setup({ rows: [r1, { ...r1, id: "r3", name: "C" }, edge, unnamed] });
  expect(seatG("r1#0")).toHaveAttribute("data-invalid", "overlap");
  expect(seatG("r3#2")).toHaveAttribute("data-invalid", "overlap");
  expect(seatG("edge#2")).toHaveAttribute("data-invalid", "outside");
  expect(seatG("edge#0")).not.toHaveAttribute("data-invalid");
  expect(rowEl("u")).toHaveAttribute("data-unnamed", "true");
  expect(rowEl("r1")).toHaveAttribute("data-unnamed", "false");
});

test("(줄 이름, 번호) 중복 좌석을 표시한다", () => {
  const { seatG } = setup({ rows: [r1, { ...r2, name: "A" }] });
  expect(seatG("r1#0")).toHaveAttribute("data-invalid", "duplicate");
  expect(seatG("r2#2")).toHaveAttribute("data-invalid", "duplicate");
});

test("밑그림을 읽기 전용으로 그린다", () => {
  const background: BackgroundImage = {
    src: "data:image/png;base64,AAAA",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    naturalWidth: 400,
    naturalHeight: 300,
    opacity: 0.5,
    locked: false,
  };
  const { container } = setup({ rows: [r1], background });
  const img = container.querySelectorAll("image");
  expect(img).toHaveLength(1);
  expect(img[0]).toHaveStyle({ pointerEvents: "none" });
});

test("pointercancel 은 드래그를 끝내고, 취소된 좌석 클릭은 토글하지 않는다", () => {
  const moving = setup({ rows: [r1] });
  fireEvent.pointerDown(moving.svg, moving.at(80, 100, { button: 0 }));
  fireEvent.pointerMove(moving.svg, moving.at(100, 100, { buttons: 1 }));
  fireEvent.pointerCancel(moving.svg, moving.at(100, 100));
  fireEvent.pointerMove(moving.svg, moving.at(150, 100, { buttons: 1 }));
  fireEvent.pointerUp(moving.svg, moving.at(150, 100));
  expect(moving.seat("r1#0")).toHaveAttribute("cx", "100");
  moving.unmount();

  const seatMode = setup({ rows: [r1], mode: "seat" });
  fireEvent.pointerDown(seatMode.svg, seatMode.at(100, 100, { button: 0 }));
  fireEvent.pointerCancel(seatMode.svg, seatMode.at(100, 100));
  fireEvent.pointerUp(seatMode.svg, seatMode.at(100, 100));
  expect(seatMode.seat("r1#1")).toHaveAttribute("fill", section.color);
});

describe("핸들(줄 1개 선택 시)", () => {
  test("회전 핸들을 오른쪽으로 끌면 90° 회전", () => {
    const { click, seat, svg, at, getByLabelText } = setup({ rows: [r1] });
    click(80, 100);
    fireEvent.pointerDown(getByLabelText("회전 핸들"), at(100, 68, { button: 0 }));
    fireEvent.pointerMove(svg, at(200, 100, { buttons: 1 }));
    fireEvent.pointerUp(svg, at(200, 100));
    expect(Number(seat("r1#0").getAttribute("cx"))).toBeCloseTo(100);
    expect(Number(seat("r1#0").getAttribute("cy"))).toBeCloseTo(80);
  });

  test("휨 핸들을 위로 끌면 가운데 좌석이 올라간다", () => {
    const { click, seat, svg, at, getByLabelText } = setup({ rows: [r1] });
    click(80, 100);
    const bend = getByLabelText("휨 핸들");
    fireEvent.pointerDown(bend, at(100, 130, { button: 0 }));
    fireEvent.pointerMove(svg, at(100, 100, { buttons: 1 }));
    fireEvent.pointerUp(svg, at(100, 100));
    expect(Number(seat("r1#1").getAttribute("cy"))).toBeLessThan(100);
  });

  test("크기 핸들을 중심에서 2배 거리로 끌면 좌석이 2배", () => {
    const { click, seat, svg, at, getAllByLabelText } = setup({ rows: [r1] });
    click(80, 100);
    const corners = getAllByLabelText("크기 핸들");
    expect(corners).toHaveLength(4);
    fireEvent.pointerDown(corners[1], at(128, 92, { button: 0 }));
    fireEvent.pointerMove(svg, at(156, 84, { buttons: 1 }));
    fireEvent.pointerUp(svg, at(156, 84));
    expect(seat("r1#0")).toHaveAttribute("r", "16");
  });

  test("줄을 2개 고르면 핸들이 없다", () => {
    const { click, queryByLabelText } = setup({ rows: [r1, r2] });
    click(80, 100);
    expect(queryByLabelText("회전 핸들")).toBeInTheDocument();
    click(80, 200, { shiftKey: true });
    expect(queryByLabelText("회전 핸들")).not.toBeInTheDocument();
  });
});

test("Ctrl+클릭만 하면(움직이지 않으면) 복제하지 않는다", () => {
  const { click, rowIds } = setup({ rows: [r1, r2] });
  click(80, 100, { ctrlKey: true });
  expect(rowIds()).toEqual(["r1", "r2"]);
});
