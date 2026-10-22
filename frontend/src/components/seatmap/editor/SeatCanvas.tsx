import { useRef, useState } from "react";
import { rowLabelsByGridRow, seatRadius } from "@/components/seatmap/core/seatGeometry";
import { SeatEditorAction, SeatEditorState } from "./seatEditorReducer";
import { Point } from "@/components/seatmap/core/types";
import { Seat } from "@/components/seatmap/core/seatTypes";
import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SeatDot from "@/components/seatmap/core/SeatDot";
import SectionOutline from "@/components/seatmap/core/SectionOutline";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { CLICK_SLOP } from "@/components/seatmap/core/viewport";

interface Props {
  state: SeatEditorState;
  dispatch: React.Dispatch<SeatEditorAction>;
}

type Drag = { kind: "select"; start: Point; last: Point; moved: boolean };

export default function SeatCanvas({ state, dispatch }: Props) {
  const dragRef = useRef<Drag | null>(null);

  const pz = usePanZoom();
  const { svgRef, view, viewRef, toContent } = pz;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);

  // 좌석 반지름은 콘텐츠 단위(간격에서 유도). 줌하면 간격과 함께 스케일되어 보기 일정.
  const seatR = seatRadius(state.grid.colPitch, state.grid.rowPitch);

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

  function shouldPan(e: React.PointerEvent): boolean {
    return state.tool === "pan" || e.button === 1;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (shouldPan(e)) return pz.beginPan(e);
    if (e.button !== 0) return;
    const start = toContent(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "select", start, last: start, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pz.updatePan(e)) return;
    const drag = dragRef.current;
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
    if (pz.endPan(e)) return;
    const drag = dragRef.current;
    if (!drag) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (drag.moved) {
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

  // pointercancel: 클릭/마퀴 선택을 확정하지 않고 드래그만 버린다.
  function handlePointerCancel(e: React.PointerEvent) {
    if (pz.endPan(e)) return;
    if (!dragRef.current) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setMarquee(null);
  }

  const sel = new Set(state.selectedIds);
  const svgCursor =
    state.tool === "pan" ? (pz.panning ? "grabbing" : "grab") : "default";

  const labelByRow = rowLabelsByGridRow(state.seats);
  const hovered = hoveredId
    ? state.seats.find((s) => s.id === hoveredId)
    : null;
  const usedCount = state.seats.filter((s) => s.available).length;

  const overlay = (
    <>
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
    </>
  );

  return (
    <MapCanvas
      pz={pz}
      cursor={svgCursor}
      svgProps={{
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onPointerLeave: () => setHoveredId(null),
      }}
      overlay={overlay}
    >
      {/* 섹션 경계(밑그림) */}
      <SectionOutline section={state.section} />

      {state.seats.map((s) => {
        const selected = sel.has(s.id);
        return (
          <SeatDot
            key={s.id}
            x={s.x}
            y={s.y}
            r={seatR}
            fill={s.available ? state.section.color : "#f3f4f6"}
            fillOpacity={s.available ? 0.9 : 1}
            stroke={
              selected ? "#111827" : s.available ? "#ffffff" : "#cbd5e1"
            }
            strokeWidth={selected ? seatR * 0.45 : seatR * 0.16}
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
    </MapCanvas>
  );
}
