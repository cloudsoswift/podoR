import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRow } from "@/components/seatmap/core/rowGeometry";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { Section } from "@/components/seatmap/core/types";
import { stubSvgGeometry } from "@/test-utils/svgGeometry";
import RowEditor from "../RowEditor";

const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const section: Section = {
  id: "s1",
  name: "A구역",
  color: "#4f46e5",
  anchors: [anchor("a", 0, 0), anchor("b", 400, 0), anchor("c", 400, 300), anchor("d", 0, 300)],
};

let restore: () => void;
beforeEach(() => {
  restore = stubSvgGeometry();
});
afterEach(() => restore());

function setup(initialRows?: SeatRow[], onExit = jest.fn()) {
  const user = userEvent.setup();
  const utils = render(<RowEditor section={section} initialRows={initialRows} onExit={onExit} />);
  const svg = utils.container.querySelector("svg")!;
  // 콘텐츠 그룹의 카메라(translate(tx ty) scale(z))로 콘텐츠 좌표를 화면 좌표로 바꾼다.
  const toScreen = (x: number, y: number) => {
    const t = svg.querySelector(":scope > g")!.getAttribute("transform")!;
    const [tx, ty, z] = (t.match(/-?[\d.]+(e-?\d+)?/g) ?? []).map(Number);
    return { clientX: x * z + tx, clientY: y * z + ty, pointerId: 1 };
  };
  const seatAt = (key: string) => {
    const c = utils.container.querySelector(`[data-seat-key="${key}"] circle`)!;
    return [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))] as const;
  };
  const circles = () => utils.container.querySelectorAll("[data-seat-key] circle");
  const rowIds = () => [...utils.container.querySelectorAll("[data-row-id]")].map((g) => g.getAttribute("data-row-id")!);
  return { ...utils, user, svg, toScreen, seatAt, circles, rowIds, onExit };
}

test("줄 추가 → 패널에 줄 입력칸, 요약 갱신", async () => {
  const { user, circles } = setup();
  const count = screen.getByLabelText("새 줄 좌석 수");
  await user.clear(count);
  await user.type(count, "4");
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  expect(circles()).toHaveLength(4);
  expect(screen.getByLabelText("줄 이름")).toBeInTheDocument();
  expect(screen.getByText("저장 좌석 4석 · 줄 1개")).toBeInTheDocument();
});

test("줄 이름을 넣으면 이름 없는 줄 표시가 사라진다", async () => {
  const { user, container } = setup([newRow("r1", 3, { x: 100, y: 100 })]);
  fireEvent.keyDown(window, { key: "Escape" });
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  const added = container.querySelectorAll("[data-row-id]")[1];
  expect(added).toHaveAttribute("data-unnamed", "true");
  await user.type(screen.getByLabelText("줄 이름"), "A");
  expect(added).toHaveAttribute("data-unnamed", "false");
});

test("input keys: 입력칸의 Backspace/Delete 는 줄을 지우지 않는다", async () => {
  const { user, rowIds } = setup();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  const name = screen.getByLabelText("줄 이름");
  await user.type(name, "AB");
  await user.keyboard("{Backspace}{Delete}");
  expect(rowIds()).toHaveLength(1);
  expect(name).toHaveValue("A");
});

test("ctrl+d: 선택 줄을 복제하고 브라우저 기본 동작을 막는다", async () => {
  const { user, rowIds, seatAt } = setup();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  await user.type(screen.getByLabelText("줄 이름"), "A");
  const notPrevented = fireEvent.keyDown(window, { key: "d", ctrlKey: true });
  expect(notPrevented).toBe(false);
  const ids = rowIds();
  expect(ids).toHaveLength(2);
  expect(screen.getByLabelText("줄 이름")).toHaveValue("A");
  expect(seatAt(`${ids[1]}#0`)[1]).toBeCloseTo(seatAt(`${ids[0]}#0`)[1] + 20);
});

test("Delete: 줄 모드는 선택 줄 삭제", async () => {
  const { user, rowIds } = setup();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  fireEvent.keyDown(window, { key: "Delete" });
  expect(rowIds()).toHaveLength(0);
});

test("좌석 모드: 마퀴로 고른 좌석을 사용 안 함 → 건너뛰기면 저장 좌석이 준다", async () => {
  const { user, svg, toScreen, seatAt } = setup([{ ...newRow("r1", 8, { x: 200, y: 150 }), name: "A" }]);
  // 줄 선택 후 건너뛰기 켜기
  fireEvent.pointerDown(svg, { ...toScreen(...seatAt("r1#0")), button: 0 });
  fireEvent.pointerUp(svg, toScreen(...seatAt("r1#0")));
  await user.click(screen.getByLabelText("사용 안 하는 좌석은 번호 건너뛰기"));
  await user.click(screen.getByRole("button", { name: "좌석" }));
  const [x0, y0] = seatAt("r1#0");
  const [x1] = seatAt("r1#1");
  fireEvent.pointerDown(svg, { ...toScreen(x0 - 5, y0 - 15), button: 0 });
  fireEvent.pointerMove(svg, { ...toScreen(x1 + 5, y0 + 15), buttons: 1 });
  fireEvent.pointerUp(svg, toScreen(x1 + 5, y0 + 15));
  expect(screen.getByText("2석 선택")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "사용 안 함" }));
  expect(screen.getByText("저장 좌석 6석 · 줄 1개")).toBeInTheDocument();
});

test("사용 안 함 좌석도 건너뛰기가 꺼져 있으면 번호를 가진다", async () => {
  setup([{ ...newRow("r1", 8, { x: 200, y: 150 }), name: "A", unavailable: [0, 1] }]);
  expect(screen.getByText("저장 좌석 8석 · 줄 1개")).toBeInTheDocument();
});

test("패널의 좌석 수를 바꾸면 끝 쪽으로 늘고 첫 좌석은 그대로", async () => {
  const { user, circles, seatAt, svg, toScreen } = setup([{ ...newRow("r1", 4, { x: 200, y: 150 }), name: "A" }]);
  const first = seatAt("r1#0");
  fireEvent.pointerDown(svg, { ...toScreen(...first), button: 0 });
  fireEvent.pointerUp(svg, toScreen(...first));
  const count = screen.getByLabelText("좌석 수");
  await user.clear(count);
  await user.type(count, "6");
  await user.tab();
  expect(circles()).toHaveLength(6);
  expect(seatAt("r1#0")[0]).toBeCloseTo(first[0]);
});

test("← 섹션: 현재 줄로 onExit", async () => {
  const rows = [{ ...newRow("r1", 2, { x: 200, y: 150 }), name: "A" }];
  const { user, onExit } = setup(rows);
  await user.click(screen.getByRole("button", { name: "← 섹션" }));
  expect(onExit).toHaveBeenCalledWith(rows);
});

test("ctrl+d: 줄 이름 입력칸에 포커스가 있어도 복제하고 기본 동작을 막는다", async () => {
  const { user, rowIds } = setup();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  const name = screen.getByLabelText("줄 이름");
  await user.type(name, "A");
  const notPrevented = fireEvent.keyDown(name, { key: "d", ctrlKey: true });
  expect(notPrevented).toBe(false);
  expect(rowIds()).toHaveLength(2);
});

test("패널 숫자 입력은 입력하던 줄에 반영되고, 다른 줄로 바꿔도 새 줄에 섞이지 않는다", async () => {
  const rows = [
    { ...newRow("ra", 3, { x: 200, y: 100 }), name: "A" },
    { ...newRow("rb", 3, { x: 200, y: 200 }), name: "B" },
  ];
  const { user, svg, toScreen, seatAt } = setup(rows);
  const click = (key: string) => {
    fireEvent.pointerDown(svg, { ...toScreen(...seatAt(key)), button: 0 });
    fireEvent.pointerUp(svg, toScreen(...seatAt(key)));
  };
  click("ra#0");
  const start = screen.getByLabelText("시작 번호");
  await user.clear(start);
  await user.type(start, "15");
  // 입력칸에서 바로 다른 줄을 고른다(포인터다운이 blur 보다 먼저 처리된다).
  click("rb#0");
  fireEvent.blur(start);
  expect(screen.getByLabelText("줄 이름")).toHaveValue("B");
  expect(screen.getByLabelText("시작 번호")).toHaveValue(1);
  click("ra#0");
  expect(screen.getByLabelText("시작 번호")).toHaveValue(15);
});

test("줄 이름 입력은 10자까지", async () => {
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: "줄 추가" }));
  const name = screen.getByLabelText("줄 이름");
  await user.type(name, "123456789012");
  expect(name).toHaveValue("1234567890");
});
