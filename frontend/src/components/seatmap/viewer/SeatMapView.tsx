"use client";

import { useMemo } from "react";
import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SeatDot from "@/components/seatmap/core/SeatDot";
import SectionOutline from "@/components/seatmap/core/SectionOutline";
import { boundsOf, polygonOf, seatRadiusFor } from "@/components/seatmap/core/seatGeometry";
import { GridConfig, Seat } from "@/components/seatmap/core/seatTypes";
import { Section } from "@/components/seatmap/core/types";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { fitView } from "@/components/seatmap/core/viewport";
import { SeatViewSeat } from "@/lib/api/seatview";
import { matchSectionSeats, SEAT_COLORS, seatLabel, seatState } from "./seatMatching";
import { useClickOrPan } from "@/components/seatmap/core/useClickOrPan";

interface Props {
  section: Section;
  layoutSeats: Seat[];
  // 좌석을 만든 간격(layoutJson 의 gridBySection). 이전 문서는 없다.
  grid?: GridConfig;
  // 이 섹션의 회차 좌석.
  eventSeats: SeatViewSeat[];
  held: Set<number>;
  selected: Set<number>;
  onToggle(eventSeatSeq: number): void;
}

/** 2단계: 에디터에서 배치한 위치 그대로의 좌석 맵. 진입 시 섹션이 화면에 꽉 차게 맞춘다. */
export default function SeatMapView({
  section,
  layoutSeats,
  grid,
  eventSeats,
  held,
  selected,
  onToggle,
}: Props) {
  const initialView = useMemo(() => fitView(boundsOf(polygonOf(section))), [section]);
  const pz = usePanZoom(initialView);
  const { svgProps, guardClick } = useClickOrPan(pz);

  const matched = useMemo(
    () => matchSectionSeats(layoutSeats, eventSeats),
    [layoutSeats, eventSeats],
  );
  const r = useMemo(() => seatRadiusFor(grid, layoutSeats), [grid, layoutSeats]);

  return (
    <MapCanvas pz={pz} cursor={pz.panning ? "grabbing" : "grab"} svgProps={svgProps}>
      <SectionOutline section={section} />
      {matched.map((m) => {
        const state = seatState(m, held, selected);
        const isSelected = state === "selected";
        const event = m.event;
        return (
          <SeatDot
            key={m.seat.id}
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
