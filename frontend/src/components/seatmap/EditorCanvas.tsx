import { useRef } from "react";
import { clamp, dist } from "./geometry";
import {
  CLOSE_RADIUS,
  EditorAction,
  EditorState,
  MIN_ANCHORS,
  VIEW_H,
  VIEW_W,
} from "./editorReducer";
import { HandleSide, Point } from "./types";
import DraftLayer from "./DraftLayer";
import SectionShape from "./SectionShape";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

type DragTarget =
  | { kind: "anchor" | "pull"; sectionId: string; anchorId: string }
  | { kind: "handle"; sectionId: string; anchorId: string; side: HandleSide };

export default function EditorCanvas({ state, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  // 핸들 더블클릭 직접 감지용 (포인터 캡처가 native dblclick 을 SVG 로 재타게팅하므로).
  const lastHandleClickRef = useRef<{
    anchorId: string;
    side: HandleSide;
    time: number;
  } | null>(null);

  /** 화면 좌표 -> SVG 사용자 좌표 변환 후 viewBox 안으로 clamp. */
  function toSvg(e: React.PointerEvent | React.MouseEvent): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return {
      x: clamp(pt.x, 0, VIEW_W),
      y: clamp(pt.y, 0, VIEW_H),
    };
  }

  function beginAnchorDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
  ) {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: e.altKey ? "pull" : "anchor",
      sectionId,
      anchorId,
    };
  }

  function beginHandleDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
    side: HandleSide,
  ) {
    e.stopPropagation();

    // 같은 핸들을 300ms 내 두 번 누르면 더블클릭으로 보고 핸들 제거(직선화).
    const now = Date.now();
    const prev = lastHandleClickRef.current;
    if (prev && prev.anchorId === anchorId && prev.side === side && now - prev.time < 300) {
      lastHandleClickRef.current = null;
      dragRef.current = null;
      dispatch({ type: "REMOVE_HANDLE", sectionId, anchorId, side });
      return;
    }
    lastHandleClickRef.current = { anchorId, side, time: now };

    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "handle", sectionId, anchorId, side };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p = toSvg(e);
    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "handle") {
        dispatch({
          type: "MOVE_HANDLE",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          side: drag.side,
          point: p,
        });
      } else if (drag.kind === "pull") {
        dispatch({
          type: "PULL_HANDLES",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          point: p,
        });
      } else {
        dispatch({
          type: "MOVE_ANCHOR",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          point: p,
        });
      }
      return;
    }
    if (state.mode === "draw") {
      dispatch({ type: "SET_CURSOR", point: p });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      svgRef.current?.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
    // draw 모드의 점 찍기/닫기만 click 으로 처리한다.
    // (select 모드 선택 해제는 onPointerDown 에서 처리: 포인터 캡처가 click 을
    //  SVG 로 재타게팅해 핸들 클릭이 배경 클릭으로 오인되는 문제를 피하기 위함)
    if (state.mode !== "draw") return;
    const p = toSvg(e);
    if (
      state.draft.length >= MIN_ANCHORS &&
      dist(p, state.draft[0]) <= CLOSE_RADIUS
    ) {
      dispatch({ type: "CLOSE_DRAFT" });
    } else {
      dispatch({ type: "ADD_DRAFT_POINT", point: p });
    }
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    // 앵커/핸들/도형의 pointerdown 은 stopPropagation 되므로 여기엔 배경 클릭만 도달.
    if (state.mode === "select" && e.target === e.currentTarget) {
      dispatch({ type: "SELECT_SECTION", id: null });
    }
  }

  const interactive = state.mode === "select";
  const canClose = state.draft.length >= MIN_ANCHORS;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-full touch-none select-none bg-white"
      style={{ cursor: state.mode === "draw" ? "crosshair" : "default" }}
      onClick={handleClick}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (state.mode === "draw") dispatch({ type: "SET_CURSOR", point: null });
      }}
    >
      {/* 보조 그리드 */}
      <defs>
        <pattern id="seatmap-grid" width={40} height={40} patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth={1} />
        </pattern>
      </defs>
      <rect
        x={0}
        y={0}
        width={VIEW_W}
        height={VIEW_H}
        fill="url(#seatmap-grid)"
        style={{ pointerEvents: "none" }}
      />

      {state.sections.map((section) => (
        <SectionShape
          key={section.id}
          section={section}
          selected={interactive && state.selectedId === section.id}
          interactive={interactive}
          onSelect={(id) => dispatch({ type: "SELECT_SECTION", id })}
          onAnchorPointerDown={beginAnchorDrag}
          onHandlePointerDown={beginHandleDrag}
        />
      ))}

      {state.mode === "draw" && (
        <DraftLayer draft={state.draft} cursor={state.cursor} canClose={canClose} />
      )}
    </svg>
  );
}
