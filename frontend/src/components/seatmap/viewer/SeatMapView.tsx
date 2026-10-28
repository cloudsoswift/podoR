"use client";

import { useEffect, useMemo, useState } from "react";
import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SeatDot from "@/components/seatmap/core/SeatDot";
import SectionOutline from "@/components/seatmap/core/SectionOutline";
import { boundsOf, flattenSection } from "@/components/seatmap/core/seatGeometry";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { Section } from "@/components/seatmap/core/types";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { ensureMinSeatSize, fitView, VIEW_H, VIEW_W } from "@/components/seatmap/core/viewport";
import { SeatViewSeat } from "@/lib/api/seatview";
import { matchSectionSeats, SEAT_COLORS, seatLabel, seatState } from "./seatMatching";
import { useClickOrPan } from "@/components/seatmap/core/useClickOrPan";

interface Props {
  section: Section;
  // 이 섹션의 줄 단위 배치.
  rows: SeatRow[];
  // 이 섹션의 회차 좌석.
  eventSeats: SeatViewSeat[];
  held: Set<number>;
  selected: Set<number>;
  onToggle(eventSeatSeq: number): void;
}

/** 2단계: 에디터에서 배치한 위치 그대로의 좌석 맵. 진입 시 섹션이 화면에 꽉 차게 맞춘다. */
export default function SeatMapView({
  section,
  rows,
  eventSeats,
  held,
  selected,
  onToggle,
}: Props) {
  const matched = useMemo(() => matchSectionSeats(rows, eventSeats), [rows, eventSeats]);

  // 줌 1 에서 콘텐츠 1단위의 화면 px. 마운트 후 처음 측정한 값만 쓴다(모르면 0).
  // 크기가 바뀔 때마다 다시 맞추면 사용자가 옮겨 둔 화면이 초기화되므로 첫 값만 쓴다.
  const [pxPerUnit, setPxPerUnit] = useState(0);
  // 섹션을 화면에 꽉 차게 맞추되, 가장 작은 좌석이 손가락으로 누를 수 있는 크기가 되도록 더 확대한다.
  const initialView = useMemo(() => {
    const b = boundsOf(flattenSection(section));
    const fit = fitView(b);
    const minR = Math.min(...matched.map((m) => m.seat.r));
    const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    const anchor = { x: center.x * fit.z + fit.tx, y: center.y * fit.z + fit.ty };
    return Number.isFinite(minR) ? ensureMinSeatSize(fit, minR, pxPerUnit, anchor) : fit;
  }, [section, matched, pxPerUnit]);
  const pz = usePanZoom(initialView);
  const { svgProps, guardClick } = useClickOrPan(pz);
  const { svgRef } = pz;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setPxPerUnit((prev) => prev || Math.min(width / VIEW_W, height / VIEW_H));
      }
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [svgRef]);

  return (
    <MapCanvas pz={pz} cursor={pz.panning ? "grabbing" : "grab"} svgProps={svgProps}>
      <SectionOutline section={section} />
      {matched.map((m) => {
        const state = seatState(m, held, selected);
        const isSelected = state === "selected";
        const event = m.event;
        const r = m.seat.r;
        return (
          <SeatDot
            key={`${m.seat.rowId}#${m.seat.index}`}
            x={m.seat.x}
            y={m.seat.y}
            r={r}
            fill={SEAT_COLORS[state]}
            stroke={isSelected ? "#1e1b4b" : "#ffffff"}
            strokeWidth={isSelected ? r * 0.45 : r * 0.16}
            label={seatLabel(m)}
            disabled={state !== "available" && state !== "selected"}
            onClick={guardClick(() => event && onToggle(event.eventSeatSeq))}
          />
        );
      })}
    </MapCanvas>
  );
}
