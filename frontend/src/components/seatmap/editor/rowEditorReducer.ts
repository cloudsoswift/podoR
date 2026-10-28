import {
  newRow,
  scaleRow,
  setRowArc,
  setRowSeatCount,
  translateRows,
} from "@/components/seatmap/core/rowGeometry";
import { RowEditorMode, SeatRow } from "@/components/seatmap/core/seatTypes";
import { Point, Section } from "@/components/seatmap/core/types";

export interface RowEditorState {
  section: Section; // 줄을 담는 섹션(경계)
  rows: SeatRow[];
  mode: RowEditorMode;
  selectedRowIds: string[]; // 줄 모드 선택
  selectedSeatKeys: string[]; // 좌석 모드 선택(seatKey)
}

export function createRowEditorState(section: Section, rows: SeatRow[] = []): RowEditorState {
  return { section, rows, mode: "row", selectedRowIds: [], selectedSeatKeys: [] };
}

export type RowEditorAction =
  | { type: "SET_MODE"; mode: RowEditorMode }
  | { type: "ADD_ROW"; id: string; seatCount: number; center: Point }
  | { type: "SELECT_ROWS"; ids: string[]; additive?: boolean }
  | { type: "MOVE_ROWS"; ids: string[]; dx: number; dy: number }
  | { type: "DUPLICATE_ROWS"; ids: string[]; newIds: string[]; dx: number; dy: number }
  | { type: "DELETE_ROWS"; ids: string[] }
  | {
      type: "UPDATE_ROW";
      id: string;
      patch: Partial<
        Pick<
          SeatRow,
          "name" | "startNumber" | "numberDirection" | "skipUnavailableNumbers" | "rotation" | "center"
        >
      >;
    }
  // 드래그 시작 시점의 줄에서 계산한 결과로 통째로 바꾼다(확대·축소 핸들).
  | { type: "SET_ROW"; row: SeatRow }
  | { type: "SCALE_ROW"; id: string; factor: number }
  | { type: "SET_ROW_ARC"; id: string; arcAngle: number }
  | { type: "SET_ROW_SEAT_COUNT"; id: string; seatCount: number }
  | { type: "SELECT_SEATS"; keys: string[] }
  | { type: "SET_SEATS_AVAILABLE"; keys: string[]; available: boolean }
  | { type: "TOGGLE_SEAT"; key: string };

/** seatKey("rowId#index") → [rowId, index]. rowId 에 '#' 이 있어도 마지막 '#' 으로 나눈다. */
function parseSeatKey(key: string): [string, number] {
  const at = key.lastIndexOf("#");
  return [key.slice(0, at), Number(key.slice(at + 1))];
}

function mapRow(state: RowEditorState, id: string, fn: (r: SeatRow) => SeatRow): RowEditorState {
  return { ...state, rows: state.rows.map((r) => (r.id === id ? fn(r) : r)) };
}

/** keys 의 좌석 사용 여부를 available 로 맞춘다. */
function setAvailable(rows: SeatRow[], keys: string[], available: boolean): SeatRow[] {
  const byRow = new Map<string, number[]>();
  for (const k of keys) {
    const [rowId, index] = parseSeatKey(k);
    byRow.set(rowId, [...(byRow.get(rowId) ?? []), index]);
  }
  return rows.map((r) => {
    const idx = byRow.get(r.id);
    if (!idx) return r;
    const set = new Set(r.unavailable);
    for (const i of idx) {
      if (available) set.delete(i);
      else set.add(i);
    }
    return { ...r, unavailable: [...set].sort((a, b) => a - b) };
  });
}

export function rowEditorReducer(state: RowEditorState, action: RowEditorAction): RowEditorState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode, selectedRowIds: [], selectedSeatKeys: [] };

    case "ADD_ROW":
      return {
        ...state,
        rows: [...state.rows, newRow(action.id, action.seatCount, action.center)],
        selectedRowIds: [action.id],
      };

    case "SELECT_ROWS": {
      if (!action.additive) return { ...state, selectedRowIds: [...new Set(action.ids)] };
      const sel = new Set(state.selectedRowIds);
      for (const id of action.ids) {
        if (sel.has(id)) sel.delete(id);
        else sel.add(id);
      }
      return { ...state, selectedRowIds: [...sel] };
    }

    case "MOVE_ROWS":
      return { ...state, rows: translateRows(state.rows, new Set(action.ids), action.dx, action.dy) };

    case "DUPLICATE_ROWS": {
      const copies: SeatRow[] = [];
      action.ids.forEach((id, i) => {
        const src = state.rows.find((r) => r.id === id);
        const newId = action.newIds[i];
        if (!src || !newId) return;
        copies.push({
          ...src,
          id: newId,
          center: { x: src.center.x + action.dx, y: src.center.y + action.dy },
          unavailable: [...src.unavailable],
        });
      });
      return { ...state, rows: [...state.rows, ...copies], selectedRowIds: copies.map((c) => c.id) };
    }

    case "DELETE_ROWS": {
      const del = new Set(action.ids);
      return {
        ...state,
        rows: state.rows.filter((r) => !del.has(r.id)),
        selectedRowIds: state.selectedRowIds.filter((id) => !del.has(id)),
      };
    }

    case "UPDATE_ROW":
      return mapRow(state, action.id, (r) => ({ ...r, ...action.patch }));

    case "SET_ROW":
      return mapRow(state, action.row.id, () => action.row);

    case "SCALE_ROW":
      return mapRow(state, action.id, (r) => scaleRow(r, action.factor));

    case "SET_ROW_ARC":
      return mapRow(state, action.id, (r) => setRowArc(r, action.arcAngle));

    case "SET_ROW_SEAT_COUNT":
      return mapRow(state, action.id, (r) => setRowSeatCount(r, action.seatCount));

    case "SELECT_SEATS":
      return { ...state, selectedSeatKeys: [...new Set(action.keys)] };

    case "SET_SEATS_AVAILABLE":
      if (action.keys.length === 0) return state;
      return { ...state, rows: setAvailable(state.rows, action.keys, action.available) };

    case "TOGGLE_SEAT": {
      const [rowId, index] = parseSeatKey(action.key);
      const row = state.rows.find((r) => r.id === rowId);
      if (!row) return state;
      const nowAvailable = row.unavailable.includes(index);
      return {
        ...state,
        rows: setAvailable(state.rows, [action.key], nowAvailable),
        selectedSeatKeys: [],
      };
    }

    default:
      return state;
  }
}
