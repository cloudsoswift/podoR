import { useMemo, useRef, useState } from "react";
import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SeatDot from "@/components/seatmap/core/SeatDot";
import SectionOutline from "@/components/seatmap/core/SectionOutline";
import { genId } from "@/components/seatmap/core/geometry";
import {
  findDuplicateSeatNumbers,
  findSeatOverlaps,
  findSeatsOutside,
  findUnnamedRows,
} from "@/components/seatmap/core/layoutValidation";
import { rowSeats, scaleRow, seatKey, setRowArc } from "@/components/seatmap/core/rowGeometry";
import { RowSeat, SeatRow } from "@/components/seatmap/core/seatTypes";
import { BackgroundImage, Point } from "@/components/seatmap/core/types";
import { PanZoom } from "@/components/seatmap/core/usePanZoom";
import { CLICK_SLOP } from "@/components/seatmap/core/viewport";
import BackgroundLayer from "./BackgroundLayer";
import { RowEditorAction, RowEditorState } from "./rowEditorReducer";
import {
  arcFromDrag,
  firstSeatMarker,
  rotationFromPoint,
  rowHandlePositions,
  scaleFactorFromDrag,
} from "./rowHandles";

interface Props {
  pz: PanZoom; // RowEditor 가 소유(새 줄 위치 계산에 현재 뷰가 필요)
  state: RowEditorState;
  dispatch: React.Dispatch<RowEditorAction>;
  background?: BackgroundImage | null; // 섹션 에디터의 밑그림(읽기 전용)
}

type Drag =
  | { kind: "move"; ids: string[]; last: Point }
  // Ctrl+드래그: 실제로 움직이기 시작할 때 복제한다(Ctrl+클릭만으로는 복제하지 않음).
  | { kind: "duplicate-pending"; ids: string[]; start: Point }
  | { kind: "marquee"; start: Point; last: Point; moved: boolean }
  | { kind: "seat-click"; key: string; start: Point; moved: boolean }
  // 핸들 드래그는 시작 시점의 줄(row)에서 매번 다시 계산한다(누적 오차 없음).
  | { kind: "scale"; row: SeatRow; start: Point }
  | { kind: "rotate"; row: SeatRow }
  | { kind: "bend"; row: SeatRow; start: Point };

type Invalid = "overlap" | "outside" | "duplicate";

const RED = "#ef4444";

/** 줄 단위 좌석 캔버스. 줄 모드는 줄 선택·이동·복제, 좌석 모드는 좌석 사용 여부 표시. */
export default function RowCanvas({ pz, state, dispatch, background }: Props) {
  const { svgRef, view, viewRef, toContent } = pz;
  const dragRef = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  const { section, rows, mode } = state;

  const seats = useMemo(() => rows.flatMap(rowSeats), [rows]);

  // 저장을 막는 문제를 실시간으로 표시한다(우선순위: 겹침 > 섹션 밖 > 번호 중복).
  const invalidOf = useMemo(() => {
    const overlap = findSeatOverlaps(seats);
    const outside = findSeatsOutside(section, seats);
    const duplicate = findDuplicateSeatNumbers(rows);
    return (key: string): Invalid | undefined =>
      overlap.has(key) ? "overlap" : outside.has(key) ? "outside" : duplicate.has(key) ? "duplicate" : undefined;
  }, [seats, section, rows]);
  const unnamed = useMemo(() => findUnnamedRows(rows), [rows]);

  const selectedRows = new Set(state.selectedRowIds);
  const selectedSeats = new Set(state.selectedSeatKeys);

  /** 콘텐츠 좌표에서 가장 가까운(히트 반경 내) 좌석. */
  function seatAt(p: Point): RowSeat | null {
    let best: RowSeat | null = null;
    let bestD = Infinity;
    for (const s of seats) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d <= Math.max(s.r, 5 / viewRef.current.z) && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function inRect(s: RowSeat, a: Point, b: Point): boolean {
    return (
      s.x >= Math.min(a.x, b.x) &&
      s.x <= Math.max(a.x, b.x) &&
      s.y >= Math.min(a.y, b.y) &&
      s.y <= Math.max(a.y, b.y)
    );
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button === 1) return pz.beginPan(e);
    if (e.button !== 0) return;
    const p = toContent(e);
    const hit = seatAt(p);
    svgRef.current?.setPointerCapture?.(e.pointerId);

    if (mode === "seat") {
      dragRef.current = hit
        ? { kind: "seat-click", key: seatKey(hit.rowId, hit.index), start: p, moved: false }
        : { kind: "marquee", start: p, last: p, moved: false };
      return;
    }

    if (!hit) {
      dragRef.current = { kind: "marquee", start: p, last: p, moved: false };
      return;
    }
    const rowId = hit.rowId;
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+드래그: 원본은 두고 복제본을 끌어 놓는다.
      const targets = selectedRows.has(rowId) ? state.selectedRowIds : [rowId];
      dragRef.current = { kind: "duplicate-pending", ids: targets, start: p };
      return;
    }
    if (e.shiftKey) {
      dispatch({ type: "SELECT_ROWS", ids: [rowId], additive: true });
      dragRef.current = null;
      return;
    }
    const ids = selectedRows.has(rowId) ? state.selectedRowIds : [rowId];
    if (!selectedRows.has(rowId)) dispatch({ type: "SELECT_ROWS", ids: [rowId] });
    dragRef.current = { kind: "move", ids, last: p };
  }

  function beginHandleDrag(e: React.PointerEvent, drag: Drag) {
    e.stopPropagation();
    if (e.button !== 0) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    dragRef.current = drag;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pz.updatePan(e)) return;
    const drag = dragRef.current;
    if (!drag) return;
    const cur = toContent(e);
    const slop = CLICK_SLOP / viewRef.current.z;
    if (drag.kind === "duplicate-pending") {
      if (Math.hypot(cur.x - drag.start.x, cur.y - drag.start.y) <= slop) return;
      const newIds = drag.ids.map(() => genId());
      dispatch({
        type: "DUPLICATE_ROWS",
        ids: drag.ids,
        newIds,
        dx: cur.x - drag.start.x,
        dy: cur.y - drag.start.y,
      });
      dragRef.current = { kind: "move", ids: newIds, last: cur };
    } else if (drag.kind === "scale") {
      dispatch({ type: "SET_ROW", row: scaleRow(drag.row, scaleFactorFromDrag(drag.row, drag.start, cur)) });
    } else if (drag.kind === "rotate") {
      dispatch({ type: "UPDATE_ROW", id: drag.row.id, patch: { rotation: rotationFromPoint(drag.row, cur) } });
    } else if (drag.kind === "bend") {
      dispatch({ type: "SET_ROW", row: setRowArc(drag.row, arcFromDrag(drag.row, drag.start, cur)) });
    } else if (drag.kind === "move") {
      const dx = cur.x - drag.last.x;
      const dy = cur.y - drag.last.y;
      if (dx || dy) {
        dispatch({ type: "MOVE_ROWS", ids: drag.ids, dx, dy });
        drag.last = cur;
      }
    } else if (drag.kind === "marquee") {
      drag.last = cur;
      if (Math.hypot(cur.x - drag.start.x, cur.y - drag.start.y) > slop) drag.moved = true;
      if (drag.moved) setMarquee({ a: drag.start, b: cur });
    } else if (Math.hypot(cur.x - drag.start.x, cur.y - drag.start.y) > slop) {
      drag.moved = true;
    }
  }

  function endDrag(e: React.PointerEvent) {
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setMarquee(null);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (pz.endPan(e)) return;
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "marquee") {
      if (drag.moved) {
        const inside = seats.filter((s) => inRect(s, drag.start, drag.last));
        if (mode === "seat") {
          dispatch({ type: "SELECT_SEATS", keys: inside.map((s) => seatKey(s.rowId, s.index)) });
        } else {
          dispatch({ type: "SELECT_ROWS", ids: [...new Set(inside.map((s) => s.rowId))] });
        }
      } else if (mode === "seat") {
        dispatch({ type: "SELECT_SEATS", keys: [] });
      } else {
        dispatch({ type: "SELECT_ROWS", ids: [] });
      }
    } else if (drag.kind === "seat-click" && !drag.moved) {
      dispatch({ type: "TOGGLE_SEAT", key: drag.key });
    }
    endDrag(e);
  }

  // pointercancel: 진행 중인 이동은 그 자리에서 멈추고, 클릭·마퀴는 확정하지 않는다.
  function handlePointerCancel(e: React.PointerEvent) {
    if (pz.endPan(e)) return;
    if (dragRef.current) endDrag(e);
  }

  const invZoom = 1 / view.z;
  // 확대·회전·휨 핸들은 줄 모드에서 정확히 한 줄을 골랐을 때만.
  const handleRow =
    mode === "row" && state.selectedRowIds.length === 1
      ? rows.find((r) => r.id === state.selectedRowIds[0])
      : undefined;
  function renderHandles(row: SeatRow) {
    const h = rowHandlePositions(row, invZoom);
    const s = invZoom;
    const topMid = { x: (h.corners[0].x + h.corners[1].x) / 2, y: (h.corners[0].y + h.corners[1].y) / 2 };
    const marker = firstSeatMarker(row, invZoom);
    const handleStyle = { fill: "#ffffff", stroke: "#4f46e5", strokeWidth: 1.5 * s };
    return (
      <g>
        <polygon
          points={h.corners.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={s}
          strokeDasharray={`${5 * s} ${4 * s}`}
          style={{ pointerEvents: "none" }}
        />
        <line x1={topMid.x} y1={topMid.y} x2={h.rotate.x} y2={h.rotate.y} stroke="#4f46e5" strokeWidth={s} />
        {/* 첫 좌석(번호 방향의 기준) 표시 */}
        <circle
          aria-label="첫 좌석"
          cx={marker.x}
          cy={marker.y}
          r={3 * s}
          fill="#4f46e5"
          style={{ pointerEvents: "none" }}
        />
        {h.corners.map((p, i) => (
          <rect
            key={i}
            aria-label="크기 핸들"
            x={p.x - 4 * s}
            y={p.y - 4 * s}
            width={8 * s}
            height={8 * s}
            {...handleStyle}
            style={{ cursor: i % 2 === 0 ? "nwse-resize" : "nesw-resize" }}
            onPointerDown={(e) => beginHandleDrag(e, { kind: "scale", row, start: toContent(e) })}
          />
        ))}
        <circle
          aria-label="회전 핸들"
          cx={h.rotate.x}
          cy={h.rotate.y}
          r={5 * s}
          {...handleStyle}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => beginHandleDrag(e, { kind: "rotate", row })}
        />
        <rect
          aria-label="휨 핸들"
          x={h.bend.x - 4 * s}
          y={h.bend.y - 4 * s}
          width={8 * s}
          height={8 * s}
          transform={`rotate(45 ${h.bend.x} ${h.bend.y})`}
          fill="#f59e0b"
          stroke="#ffffff"
          strokeWidth={s}
          style={{ cursor: "ns-resize" }}
          onPointerDown={(e) => beginHandleDrag(e, { kind: "bend", row, start: toContent(e) })}
        />
      </g>
    );
  }

  const cursor = pz.panning ? "grabbing" : mode === "seat" ? "pointer" : "default";

  const overlay =
    rows.length === 0 ? (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-gray-400 shadow-sm">
          상단에서 좌석 수를 정하고 &lsquo;줄 추가&rsquo;를 누르세요.
        </p>
      </div>
    ) : null;

  return (
    <MapCanvas
      pz={pz}
      cursor={cursor}
      svgProps={{
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
      }}
      overlay={overlay}
    >
      {background && (
        <BackgroundLayer
          background={background}
          editable={false}
          scale={invZoom}
          onBodyPointerDown={() => {}}
          onHandlePointerDown={() => {}}
        />
      )}
      <SectionOutline section={section} />

      {rows.map((row) => {
        const rowSelected = mode === "row" && selectedRows.has(row.id);
        const rowUnnamed = unnamed.has(row.id);
        return (
          <g
            key={row.id}
            data-row-id={row.id}
            data-selected={rowSelected ? "true" : "false"}
            data-unnamed={rowUnnamed ? "true" : "false"}
          >
            {rowSeats(row).map((s) => {
              const key = seatKey(s.rowId, s.index);
              const invalid = invalidOf(key);
              const fill = invalid === "overlap" ? RED : s.available ? section.color : "#f3f4f6";
              const stroke =
                invalid === "outside" || invalid === "duplicate"
                  ? RED
                  : selectedSeats.has(key)
                    ? "#111827"
                    : rowUnnamed
                      ? "#f59e0b"
                      : rowSelected
                        ? "#4f46e5"
                        : s.available
                          ? "#ffffff"
                          : "#cbd5e1";
              const emphasized = stroke !== "#ffffff" && stroke !== "#cbd5e1";
              return (
                <g key={key} data-seat-key={key} data-invalid={invalid}>
                  <SeatDot
                    x={s.x}
                    y={s.y}
                    r={s.r}
                    fill={fill}
                    fillOpacity={s.available ? 0.9 : 1}
                    stroke={stroke}
                    strokeWidth={s.r * (emphasized ? 0.3 : 0.16)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {handleRow && renderHandles(handleRow)}

      {marquee && (
        <rect
          x={Math.min(marquee.a.x, marquee.b.x)}
          y={Math.min(marquee.a.y, marquee.b.y)}
          width={Math.abs(marquee.b.x - marquee.a.x)}
          height={Math.abs(marquee.b.y - marquee.a.y)}
          fill="#6366f1"
          fillOpacity={0.1}
          stroke="#6366f1"
          strokeWidth={invZoom}
          style={{ pointerEvents: "none" }}
        />
      )}
    </MapCanvas>
  );
}
