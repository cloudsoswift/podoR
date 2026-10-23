import { newRow } from "@/components/seatmap/core/rowGeometry";
import { Section } from "@/components/seatmap/core/types";
import { createRowEditorState, rowEditorReducer, RowEditorState } from "../rowEditorReducer";

const section: Section = { id: "s1", name: "A구역", color: "#000", anchors: [] };
const rowA = { ...newRow("a", 4, { x: 100, y: 100 }), name: "A", startNumber: 5 };
const rowB = newRow("b", 2, { x: 100, y: 200 });

function stateWith(patch: Partial<RowEditorState> = {}): RowEditorState {
  return { ...createRowEditorState(section, [rowA, rowB]), ...patch };
}

test("초기 상태: 줄 모드, 선택 없음", () => {
  const s = createRowEditorState(section);
  expect(s).toMatchObject({ rows: [], mode: "row", selectedRowIds: [], selectedSeatKeys: [] });
});

test("ADD_ROW: 이름 없는 새 줄을 추가하고 그 줄만 선택", () => {
  const s = rowEditorReducer(createRowEditorState(section), {
    type: "ADD_ROW",
    id: "n",
    seatCount: 3,
    center: { x: 10, y: 20 },
  });
  expect(s.rows).toHaveLength(1);
  expect(s.rows[0]).toMatchObject({ id: "n", name: "", seatCount: 3, center: { x: 10, y: 20 } });
  expect(s.selectedRowIds).toEqual(["n"]);
});

test("SELECT_ROWS additive 는 토글로 합친다", () => {
  let s = rowEditorReducer(stateWith(), { type: "SELECT_ROWS", ids: ["a"] });
  s = rowEditorReducer(s, { type: "SELECT_ROWS", ids: ["b"], additive: true });
  expect(s.selectedRowIds).toEqual(["a", "b"]);
  s = rowEditorReducer(s, { type: "SELECT_ROWS", ids: ["a"], additive: true });
  expect(s.selectedRowIds).toEqual(["b"]);
});

test("DUPLICATE_ROWS: 이름·번호 설정을 복사해 옮기고 복제본만 선택", () => {
  const s = rowEditorReducer(stateWith(), {
    type: "DUPLICATE_ROWS",
    ids: ["a"],
    newIds: ["c"],
    dx: 0,
    dy: 20,
  });
  expect(s.rows).toHaveLength(3);
  expect(s.rows[2]).toMatchObject({ id: "c", name: "A", startNumber: 5, center: { x: 100, y: 120 } });
  expect(s.rows[0].center).toEqual({ x: 100, y: 100 });
  expect(s.selectedRowIds).toEqual(["c"]);
});

test("MOVE_ROWS 는 지정한 줄만 이동", () => {
  const s = rowEditorReducer(stateWith(), { type: "MOVE_ROWS", ids: ["b"], dx: 5, dy: -5 });
  expect(s.rows.map((r) => r.center)).toEqual([
    { x: 100, y: 100 },
    { x: 105, y: 195 },
  ]);
});

test("DELETE_ROWS 는 줄과 선택을 함께 지운다", () => {
  const s = rowEditorReducer(stateWith({ selectedRowIds: ["a", "b"] }), {
    type: "DELETE_ROWS",
    ids: ["a"],
  });
  expect(s.rows.map((r) => r.id)).toEqual(["b"]);
  expect(s.selectedRowIds).toEqual(["b"]);
});

test("UPDATE_ROW·SCALE_ROW·SET_ROW_ARC·SET_ROW_SEAT_COUNT 는 해당 줄만 바꾼다", () => {
  let s = rowEditorReducer(stateWith(), { type: "UPDATE_ROW", id: "b", patch: { name: "B" } });
  s = rowEditorReducer(s, { type: "SCALE_ROW", id: "b", factor: 2 });
  s = rowEditorReducer(s, { type: "SET_ROW_SEAT_COUNT", id: "b", seatCount: 3 });
  s = rowEditorReducer(s, { type: "SET_ROW_ARC", id: "b", arcAngle: 30 });
  expect(s.rows[1]).toMatchObject({ name: "B", seatRadius: 16, seatCount: 3, arcAngle: 30 });
  expect(s.rows[0]).toBe(rowA);
});

test("SET_SEATS_AVAILABLE 는 줄별 unavailable 인덱스를 갱신", () => {
  let s = rowEditorReducer(stateWith(), {
    type: "SET_SEATS_AVAILABLE",
    keys: ["a#1", "a#3"],
    available: false,
  });
  expect(s.rows[0].unavailable).toEqual([1, 3]);
  s = rowEditorReducer(s, { type: "SET_SEATS_AVAILABLE", keys: ["a#1"], available: true });
  expect(s.rows[0].unavailable).toEqual([3]);
});

test("TOGGLE_SEAT 두 번이면 원래대로, 좌석 선택은 비운다", () => {
  let s = rowEditorReducer(stateWith({ selectedSeatKeys: ["b#0"] }), { type: "TOGGLE_SEAT", key: "a#0" });
  expect(s.rows[0].unavailable).toEqual([0]);
  expect(s.selectedSeatKeys).toEqual([]);
  s = rowEditorReducer(s, { type: "TOGGLE_SEAT", key: "a#0" });
  expect(s.rows[0].unavailable).toEqual([]);
});

test("SET_MODE 는 두 선택을 모두 비운다", () => {
  const s = rowEditorReducer(stateWith({ selectedRowIds: ["a"], selectedSeatKeys: ["a#0"] }), {
    type: "SET_MODE",
    mode: "seat",
  });
  expect(s).toMatchObject({ mode: "seat", selectedRowIds: [], selectedSeatKeys: [] });
});
