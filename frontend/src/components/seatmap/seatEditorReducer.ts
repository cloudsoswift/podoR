import { genId } from "./geometry";
import { Section } from "./types";
import { GridConfig, Seat, SeatTool } from "./seatTypes";
import { generateSeats } from "./seatGeometry";

// 좌석 편집 대상이 없을 때 사용하는 샘플 섹션(직사각형).
export const SAMPLE_SECTION: Section = {
  id: "sample-section",
  name: "샘플 섹션",
  color: "#6366f1",
  anchors: [
    { id: genId(), x: 300, y: 170, handleIn: null, handleOut: null },
    { id: genId(), x: 700, y: 170, handleIn: null, handleOut: null },
    { id: genId(), x: 700, y: 520, handleIn: null, handleOut: null },
    { id: genId(), x: 300, y: 520, handleIn: null, handleOut: null },
  ],
};

export const DEFAULT_GRID: GridConfig = {
  colPitch: 14,
  rowPitch: 18,
};

export interface SeatEditorState {
  section: Section; // 좌석을 담는 경계 폴리곤
  seats: Seat[];
  selectedIds: string[]; // 마퀴/클릭으로 선택된 좌석
  tool: SeatTool;
  grid: GridConfig;
}

export function createInitialState(
  section: Section = SAMPLE_SECTION,
): SeatEditorState {
  return {
    section,
    seats: [],
    selectedIds: [],
    tool: "select",
    grid: DEFAULT_GRID,
  };
}

export type SeatEditorAction =
  | { type: "SET_TOOL"; tool: SeatTool }
  | { type: "SET_GRID"; patch: Partial<GridConfig> }
  | { type: "GENERATE_GRID" }
  | { type: "CLEAR_SEATS" }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "SET_SEATS_AVAILABLE"; ids: string[]; available: boolean }
  | { type: "SET_ALL_AVAILABLE"; available: boolean }
  | { type: "SET_SECTION"; section: Section };

export function seatEditorReducer(
  state: SeatEditorState,
  action: SeatEditorAction,
): SeatEditorState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, tool: action.tool };

    case "SET_GRID":
      return { ...state, grid: { ...state.grid, ...action.patch } };

    case "GENERATE_GRID":
      return {
        ...state,
        seats: generateSeats(state.section, state.grid),
        selectedIds: [],
      };

    case "CLEAR_SEATS":
      return { ...state, seats: [], selectedIds: [] };

    case "SET_SELECTION":
      return { ...state, selectedIds: Array.from(new Set(action.ids)) };

    case "SET_SEATS_AVAILABLE": {
      if (action.ids.length === 0) return state;
      const ids = new Set(action.ids);
      return {
        ...state,
        seats: state.seats.map((s) =>
          ids.has(s.id) ? { ...s, available: action.available } : s,
        ),
      };
    }

    case "SET_ALL_AVAILABLE":
      return {
        ...state,
        seats: state.seats.map((s) => ({ ...s, available: action.available })),
      };

    case "SET_SECTION":
      return { ...state, section: action.section, seats: [], selectedIds: [] };

    default:
      return state;
  }
}
