import { useEffect, useRef, useState } from "react";
import { clamp, sectionToPath } from "./geometry";
import { VIEW_H, VIEW_W } from "./editorReducer";
import { rowLabel } from "./seatGeometry";
import { SeatEditorAction, SeatEditorState } from "./seatEditorReducer";
import { Point } from "./types";
import { Seat } from "./seatTypes";

interface Props {
  state: SeatEditorState;
  dispatch: React.Dispatch<SeatEditorAction>;
}

interface View {
  tx: number;
  ty: number;
  z: number;
}

const MIN_Z = 0.2;
const MAX_Z = 8;
const INITIAL_VIEW: View = { tx: 0, ty: 0, z: 1 };
// 클릭/드래그를 구분하는 이동 임계값(화면 px).
const CLICK_SLOP = 4;

type Drag =
  | { kind: "pan"; startRoot: Point; startTx: number; startTy: number }
  | { kind: "select"; start: Point; last: Point; moved: boolean };

export default function SeatCanvas({ state, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const [view, setViewState] = useState<View>(INITIAL_VIEW);
  const viewRef = useRef<View>(INITIAL_VIEW);
  const [panning, setPanning] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);

  // 좌석 반지름은 콘텐츠 단위(간격에서 유도). 줌하면 간격과 함께 스케일되어 보기 일정.
  const seatR = Math.max(1, Math.min(state.grid.colPitch, state.grid.rowPitch) * 0.4);

  function applyView(next: View) {
    const v: View = { tx: next.tx, ty: next.ty, z: clamp(next.z, MIN_Z, MAX_Z) };
    viewRef.current = v;
    setViewState(v);
  }

  function toRoot(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function toContent(e: React.PointerEvent | React.MouseEvent): Point {
    const r = toRoot(e.clientX, e.clientY);
    const v = viewRef.current;
    return { x: (r.x - v.tx) / v.z, y: (r.y - v.ty) / v.z };
  }

  /** 콘텐츠 좌표에서 가장 가까운(히트 반경 내) 좌석. */
  function seatAt(p: Point): Seat | null {
    const hitR = Math.max(seatR, 5 / viewRef.current.z);
    let best: Seat | null = null;
    let bestD = hitR;
    for (const s of state.seats) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

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

  function shouldPan(e: React.PointerEvent): boolean {
    return state.tool === "pan" || e.button === 1;
  }

  function startPan(e: React.PointerEvent) {
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

  function handlePointerDown(e: React.PointerEvent) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    const start = toContent(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "select", start, last: start, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag?.kind === "pan") {
      const root = toRoot(e.clientX, e.clientY);
      applyView({
        z: viewRef.current.z,
        tx: drag.startTx + (root.x - drag.startRoot.x),
        ty: drag.startTy + (root.y - drag.startRoot.y),
      });
      return;
    }
    if (drag?.kind === "select") {
      const cur = toContent(e);
      drag.last = cur;
      const moved =
        Math.hypot(cur.x - drag.start.x, cur.y - drag.start.y) >
        CLICK_SLOP / viewRef.current.z;
      if (moved) {
        drag.moved = true;
        setMarquee({ a: drag.start, b: cur });
      }
      return;
    }
    // 유휴: 호버 추적(선택 도구).
    if (state.tool === "select") {
      const seat = seatAt(toContent(e));
      setHoveredId(seat ? seat.id : null);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (drag.kind === "pan") {
      setPanning(false);
    } else if (drag.moved) {
      // 마퀴: 사각형(좌상→우하) 안의 좌석 선택(교체).
      const minX = Math.min(drag.start.x, drag.last.x);
      const maxX = Math.max(drag.start.x, drag.last.x);
      const minY = Math.min(drag.start.y, drag.last.y);
      const maxY = Math.max(drag.start.y, drag.last.y);
      const ids = state.seats
        .filter((s) => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
        .map((s) => s.id);
      dispatch({ type: "SET_SELECTION", ids });
    } else {
      // 클릭: 좌석이면 사용/미사용 토글, 빈 곳이면 선택 해제.
      const seat = seatAt(drag.start);
      if (seat) {
        dispatch({
          type: "SET_SEATS_AVAILABLE",
          ids: [seat.id],
          available: !seat.available,
        });
        dispatch({ type: "SET_SELECTION", ids: [] });
      } else {
        dispatch({ type: "SET_SELECTION", ids: [] });
      }
    }
    dragRef.current = null;
    setMarquee(null);
  }

  const sel = new Set(state.selectedIds);
  const outline = sectionToPath(state.section);
  const svgCursor =
    state.tool === "pan" ? (panning ? "grabbing" : "grab") : "default";

  const presentRows = [...new Set(state.seats.map((s) => s.gridRow))].sort(
    (a, b) => a - b,
  );
  const labelByRow = new Map(presentRows.map((gr, i) => [gr, rowLabel(i)]));
  const hovered = hoveredId
    ? state.seats.find((s) => s.id === hoveredId)
    : null;
  const usedCount = state.seats.filter((s) => s.available).length;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-full w-full touch-none select-none bg-white"
        style={{ cursor: svgCursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHoveredId(null)}
      >
        <defs>
          <pattern
            id="seat-grid"
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
            fill="url(#seat-grid)"
            stroke="#e2e8f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />

          {/* 섹션 경계(밑그림) */}
          <path
            d={outline}
            fill={state.section.color}
            fillOpacity={0.06}
            stroke={state.section.color}
            strokeOpacity={0.5}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />

          {state.seats.map((s) => {
            const selected = sel.has(s.id);
            return (
              <circle
                key={s.id}
                cx={s.x}
                cy={s.y}
                r={seatR}
                fill={s.available ? state.section.color : "#f3f4f6"}
                fillOpacity={s.available ? 0.9 : 1}
                stroke={
                  selected ? "#111827" : s.available ? "#ffffff" : "#cbd5e1"
                }
                strokeWidth={selected ? seatR * 0.45 : seatR * 0.16}
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {marquee && (
            <rect
              x={Math.min(marquee.a.x, marquee.b.x)}
              y={Math.min(marquee.a.y, marquee.b.y)}
              width={Math.abs(marquee.b.x - marquee.a.x)}
              height={Math.abs(marquee.b.y - marquee.a.y)}
              fill="#6366f1"
              fillOpacity={0.1}
              stroke="#6366f1"
              strokeWidth={1 / view.z}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      </svg>

      {state.seats.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-gray-400 shadow-sm">
            상단의 &lsquo;좌석 채우기&rsquo;로 섹션을 격자로 채우세요.
          </p>
        </div>
      )}

      {/* 상태 패널: 사용/전체, 선택 수, 호버 좌석 정보 */}
      {state.seats.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
          <span className="text-gray-500">사용 </span>
          <span className="font-semibold text-gray-900">{usedCount}</span>
          <span className="text-gray-400"> / {state.seats.length}</span>
          {sel.size > 0 && (
            <span className="ml-2 border-l border-gray-200 pl-2 text-indigo-600">
              {sel.size}석 선택
            </span>
          )}
          {hovered && (
            <span className="ml-2 border-l border-gray-200 pl-2 text-gray-600">
              {labelByRow.get(hovered.gridRow)}열 {hovered.number}번
              {!hovered.available && (
                <span className="ml-1 text-red-500">· 사용 안 함</span>
              )}
            </span>
          )}
        </div>
      )}

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
