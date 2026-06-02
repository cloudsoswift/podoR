import { useEffect, useRef, useState } from "react";
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

/** 콘텐츠 그룹에 적용되는 카메라: translate(tx,ty) 후 scale(z). */
interface View {
  tx: number;
  ty: number;
  z: number;
}

const MIN_Z = 0.2;
const MAX_Z = 8;
const INITIAL_VIEW: View = { tx: 0, ty: 0, z: 1 };
const DBL_MS = 300;

type DragTarget =
  | { kind: "anchor"; sectionId: string; anchorId: string }
  | { kind: "handle"; sectionId: string; anchorId: string; side: HandleSide }
  | { kind: "section"; sectionId: string; last: Point }
  | { kind: "pan"; startRoot: Point; startTx: number; startTy: number };

export default function EditorCanvas({ state, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  // 포인터 캡처가 click 을 SVG 로 재타게팅하므로, 도형/앵커 조작 후의 click 은 무시한다.
  const suppressClickRef = useRef(false);
  // 더블클릭 직접 감지용(앵커=곡선/직선 토글, 핸들=한쪽 직선화).
  const lastAnchorClickRef = useRef<{ anchorId: string; time: number } | null>(
    null,
  );
  const lastHandleClickRef = useRef<{
    anchorId: string;
    side: HandleSide;
    time: number;
  } | null>(null);

  // 카메라. 네이티브 휠 리스너에서도 최신값을 읽도록 ref 로 미러링.
  const [view, setViewState] = useState<View>(INITIAL_VIEW);
  const viewRef = useRef<View>(INITIAL_VIEW);
  const [panning, setPanning] = useState(false);

  function applyView(next: View) {
    const v: View = {
      tx: next.tx,
      ty: next.ty,
      z: clamp(next.z, MIN_Z, MAX_Z),
    };
    viewRef.current = v;
    setViewState(v);
  }

  /** 화면 좌표 -> 루트(viewBox) 좌표. g 변환은 포함하지 않는다. */
  function toRoot(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /** 화면 좌표 -> 콘텐츠 좌표(카메라 역변환) 후 종이 영역으로 clamp. */
  function toSvg(e: React.PointerEvent | React.MouseEvent): Point {
    const r = toRoot(e.clientX, e.clientY);
    const v = viewRef.current;
    return {
      x: clamp((r.x - v.tx) / v.z, 0, VIEW_W),
      y: clamp((r.y - v.ty) / v.z, 0, VIEW_H),
    };
  }

  /** 주어진 루트 좌표를 고정점으로 factor 배 줌. */
  function zoomBy(factor: number, root: Point) {
    const v = viewRef.current;
    const newZ = clamp(v.z * factor, MIN_Z, MAX_Z);
    const k = newZ / v.z;
    if (k === 1) return;
    applyView({
      z: newZ,
      tx: root.x - (root.x - v.tx) * k,
      ty: root.y - (root.y - v.ty) * k,
    });
  }

  // 네이티브 휠 리스너(React onWheel 은 passive 라 preventDefault 가 불안정).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015), toRoot(e.clientX, e.clientY));
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 가운데 버튼(button 1)은 어느 도구에서나 팬. (키보드 조합 아님)
  function shouldPan(e: React.PointerEvent): boolean {
    return state.tool === "pan" || e.button === 1;
  }

  function startPan(e: React.PointerEvent) {
    e.stopPropagation();
    suppressClickRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    const v = viewRef.current;
    dragRef.current = {
      kind: "pan",
      startRoot: toRoot(e.clientX, e.clientY),
      startTx: v.tx,
      startTy: v.ty,
    };
    setPanning(true);
  }

  function beginSectionDrag(e: React.PointerEvent, sectionId: string) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;
    dispatch({ type: "SELECT_SECTION", id: sectionId });
    // 선택 도구에서만 바디 드래그로 섹션 전체를 옮긴다.
    if (state.tool === "select") {
      svgRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "section", sectionId, last: toSvg(e) };
    }
  }

  function beginAnchorDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
  ) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;

    // 더블클릭: 곡선 앵커면 직선화, 코너면 곡선화 토글.
    const now = Date.now();
    const prev = lastAnchorClickRef.current;
    if (prev && prev.anchorId === anchorId && now - prev.time < DBL_MS) {
      lastAnchorClickRef.current = null;
      dragRef.current = null;
      const sec = state.sections.find((s) => s.id === sectionId);
      const a = sec?.anchors.find((an) => an.id === anchorId);
      const hasHandles = !!(a && (a.handleIn || a.handleOut));
      dispatch({
        type: hasHandles ? "STRAIGHTEN_ANCHOR" : "SMOOTH_ANCHOR",
        sectionId,
        anchorId,
      });
      return;
    }
    lastAnchorClickRef.current = { anchorId, time: now };

    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "anchor", sectionId, anchorId };
  }

  function beginHandleDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
    side: HandleSide,
  ) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;

    // 같은 핸들을 더블클릭하면 해당 변을 직선화(핸들 제거).
    const now = Date.now();
    const prev = lastHandleClickRef.current;
    if (
      prev &&
      prev.anchorId === anchorId &&
      prev.side === side &&
      now - prev.time < DBL_MS
    ) {
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
    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "pan") {
        const root = toRoot(e.clientX, e.clientY);
        applyView({
          z: viewRef.current.z,
          tx: drag.startTx + (root.x - drag.startRoot.x),
          ty: drag.startTy + (root.y - drag.startRoot.y),
        });
        return;
      }
      if (drag.kind === "section") {
        const cur = toSvg(e);
        const dx = cur.x - drag.last.x;
        const dy = cur.y - drag.last.y;
        if (dx || dy) {
          dispatch({ type: "MOVE_SECTION", id: drag.sectionId, dx, dy });
          drag.last = cur;
        }
        return;
      }
      const p = toSvg(e);
      if (drag.kind === "handle") {
        dispatch({
          type: "MOVE_HANDLE",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          side: drag.side,
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
    if (state.tool === "pen") {
      dispatch({ type: "SET_CURSOR", point: toSvg(e) });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      svgRef.current?.releasePointerCapture(e.pointerId);
      if (dragRef.current.kind === "pan") setPanning(false);
      dragRef.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
    // 도형/앵커 조작 직후의 재타게팅된 click 은 무시.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // 펜 도구의 점 찍기/닫기만 click 으로 처리.
    if (state.tool !== "pen") return;
    const p = toSvg(e);
    const closeR = CLOSE_RADIUS / viewRef.current.z;
    if (state.draft.length >= MIN_ANCHORS && dist(p, state.draft[0]) <= closeR) {
      dispatch({ type: "CLOSE_DRAFT" });
    } else {
      dispatch({ type: "ADD_DRAFT_POINT", point: p });
    }
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    // 앵커/핸들/도형의 pointerdown 은 stopPropagation 되므로 여기엔 배경만 도달.
    if (shouldPan(e)) return startPan(e);
    // 배경 클릭: 펜이면 click 에서 점 추가하므로 suppress 해제, 선택이면 선택 해제.
    suppressClickRef.current = false;
    if (state.tool === "select" && e.target === e.currentTarget) {
      dispatch({ type: "SELECT_SECTION", id: null });
    }
  }

  const invZoom = 1 / view.z;
  const canClose = state.draft.length >= MIN_ANCHORS;
  const drawing = state.tool === "pen" && state.draft.length > 0;
  // 도형 바디 상호작용: 선택 도구, 또는 펜 도구이면서 새로 그리는 중이 아닐 때.
  const bodyInteractive =
    state.tool === "select" || (state.tool === "pen" && !drawing);
  const bodyCursor = state.tool === "select" ? "move" : "pointer";

  const svgCursor =
    state.tool === "pan"
      ? panning
        ? "grabbing"
        : "grab"
      : state.tool === "pen"
        ? "crosshair"
        : "default";

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-full w-full touch-none select-none bg-white"
        style={{ cursor: svgCursor }}
        onClick={handleClick}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (state.tool === "pen") dispatch({ type: "SET_CURSOR", point: null });
        }}
      >
        {/* 보조 그리드 */}
        <defs>
          <pattern
            id="seatmap-grid"
            width={40}
            height={40}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.z})`}>
          <rect
            x={0}
            y={0}
            width={VIEW_W}
            height={VIEW_H}
            fill="url(#seatmap-grid)"
            stroke="#e2e8f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />

          {state.sections.map((section) => {
            const selected = state.selectedId === section.id;
            return (
              <SectionShape
                key={section.id}
                section={section}
                selected={bodyInteractive && selected}
                bodyInteractive={bodyInteractive}
                editable={state.tool === "pen" && !drawing && selected}
                scale={invZoom}
                bodyCursor={bodyCursor}
                onSectionPointerDown={beginSectionDrag}
                onAnchorPointerDown={beginAnchorDrag}
                onHandlePointerDown={beginHandleDrag}
              />
            );
          })}

          {state.tool === "pen" && (
            <DraftLayer
              draft={state.draft}
              cursor={state.cursor}
              canClose={canClose}
              scale={invZoom}
            />
          )}
        </g>
      </svg>

      {/* 줌 컨트롤 */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2, { x: VIEW_W / 2, y: VIEW_H / 2 })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="축소"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => applyView(INITIAL_VIEW)}
          className="min-w-[3rem] rounded-md px-1 text-center text-xs font-medium text-gray-600 hover:bg-gray-100"
          title="뷰 초기화"
        >
          {Math.round(view.z * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.2, { x: VIEW_W / 2, y: VIEW_H / 2 })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="확대"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
