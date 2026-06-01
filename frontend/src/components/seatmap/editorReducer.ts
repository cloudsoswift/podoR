import { genId, mirror, pointsToAnchors } from "./geometry";
import { Anchor, HandleSide, Mode, Point, Section } from "./types";

export const VIEW_W = 1000;
export const VIEW_H = 700;
export const CLOSE_RADIUS = 12; // 첫 점 근처 클릭으로 인정하는 SVG 단위 반경
export const MIN_ANCHORS = 3;

const PALETTE = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

export interface EditorState {
  mode: Mode;
  sections: Section[];
  selectedId: string | null;
  draft: Point[];
  cursor: Point | null;
}

export const initialState: EditorState = {
  mode: "draw",
  sections: [],
  selectedId: null,
  draft: [],
  cursor: null,
};

export type EditorAction =
  | { type: "SET_MODE"; mode: Mode }
  | { type: "ADD_DRAFT_POINT"; point: Point }
  | { type: "SET_CURSOR"; point: Point | null }
  | { type: "CANCEL_DRAFT" }
  | { type: "CLOSE_DRAFT" }
  | { type: "SELECT_SECTION"; id: string | null }
  | { type: "MOVE_ANCHOR"; sectionId: string; anchorId: string; point: Point }
  | {
      type: "MOVE_HANDLE";
      sectionId: string;
      anchorId: string;
      side: HandleSide;
      point: Point;
    }
  | { type: "PULL_HANDLES"; sectionId: string; anchorId: string; point: Point }
  | { type: "REMOVE_HANDLE"; sectionId: string; anchorId: string; side: HandleSide }
  | { type: "DELETE_SECTION"; id: string }
  | { type: "RENAME_SECTION"; id: string; name: string }
  | { type: "SET_COLOR"; id: string; color: string }
  | { type: "LOAD_SECTIONS"; sections: Section[] }
  | { type: "RESET" };

function mapSection(
  sections: Section[],
  id: string,
  fn: (s: Section) => Section,
): Section[] {
  return sections.map((s) => (s.id === id ? fn(s) : s));
}

function mapAnchor(
  section: Section,
  anchorId: string,
  fn: (a: Anchor) => Anchor,
): Section {
  return {
    ...section,
    anchors: section.anchors.map((a) => (a.id === anchorId ? fn(a) : a)),
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "SET_MODE":
      // 모드를 벗어나면 그리던 draft 는 버린다.
      return { ...state, mode: action.mode, draft: [], cursor: null };

    case "ADD_DRAFT_POINT":
      return { ...state, draft: [...state.draft, action.point] };

    case "SET_CURSOR":
      return { ...state, cursor: action.point };

    case "CANCEL_DRAFT":
      return { ...state, draft: [], cursor: null };

    case "CLOSE_DRAFT": {
      if (state.draft.length < MIN_ANCHORS) return state;
      const section: Section = {
        id: genId(),
        name: `섹션 ${state.sections.length + 1}`,
        color: PALETTE[state.sections.length % PALETTE.length],
        anchors: pointsToAnchors(state.draft),
      };
      return {
        ...state,
        sections: [...state.sections, section],
        draft: [],
        cursor: null,
        mode: "select",
        selectedId: section.id,
      };
    }

    case "SELECT_SECTION":
      return { ...state, selectedId: action.id };

    case "MOVE_ANCHOR": {
      const sections = mapSection(state.sections, action.sectionId, (s) =>
        mapAnchor(s, action.anchorId, (a) => {
          const dx = action.point.x - a.x;
          const dy = action.point.y - a.y;
          // 앵커를 옮기면 보유한 핸들도 같은 delta 로 이동.
          return {
            ...a,
            x: action.point.x,
            y: action.point.y,
            handleIn: a.handleIn
              ? { x: a.handleIn.x + dx, y: a.handleIn.y + dy }
              : null,
            handleOut: a.handleOut
              ? { x: a.handleOut.x + dx, y: a.handleOut.y + dy }
              : null,
          };
        }),
      );
      return { ...state, sections };
    }

    case "MOVE_HANDLE": {
      const sections = mapSection(state.sections, action.sectionId, (s) =>
        mapAnchor(s, action.anchorId, (a) => ({
          ...a,
          [action.side === "in" ? "handleIn" : "handleOut"]: action.point,
        })),
      );
      return { ...state, sections };
    }

    case "PULL_HANDLES": {
      // Alt-드래그: out=커서, in=대칭점 -> 부드러운 곡선 앵커로 전환.
      const sections = mapSection(state.sections, action.sectionId, (s) =>
        mapAnchor(s, action.anchorId, (a) => ({
          ...a,
          handleOut: action.point,
          handleIn: mirror({ x: a.x, y: a.y }, action.point),
        })),
      );
      return { ...state, sections };
    }

    case "REMOVE_HANDLE": {
      const sections = mapSection(state.sections, action.sectionId, (s) =>
        mapAnchor(s, action.anchorId, (a) => ({
          ...a,
          [action.side === "in" ? "handleIn" : "handleOut"]: null,
        })),
      );
      return { ...state, sections };
    }

    case "DELETE_SECTION":
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "RENAME_SECTION":
      return {
        ...state,
        sections: mapSection(state.sections, action.id, (s) => ({
          ...s,
          name: action.name,
        })),
      };

    case "SET_COLOR":
      return {
        ...state,
        sections: mapSection(state.sections, action.id, (s) => ({
          ...s,
          color: action.color,
        })),
      };

    case "LOAD_SECTIONS":
      return {
        ...state,
        sections: action.sections,
        selectedId: null,
        draft: [],
        cursor: null,
        mode: "select",
      };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}
