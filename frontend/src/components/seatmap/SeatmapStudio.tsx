"use client";

import { useState } from "react";
import SectionEditor from "./SectionEditor";
import SeatEditor from "./SeatEditor";
import { Section } from "./types";
import { Seat } from "./seatTypes";

/**
 * 섹션 에디터와 좌석 에디터를 한 화면에서 오가는 통합 컨테이너.
 * 섹션 에디터는 항상 마운트 상태로 두고(작업 보존), 좌석 편집 중에는 숨긴다.
 * 좌석은 섹션 id 별로 보관해 다시 진입해도 이어서 편집할 수 있다.
 */
export default function SeatmapStudio() {
  const [editing, setEditing] = useState<Section | null>(null);
  const [seatsBySection, setSeatsBySection] = useState<Record<string, Seat[]>>(
    {},
  );

  function handleEditSeats(section: Section) {
    setEditing(section);
  }

  function handleExit(seats: Seat[]) {
    if (editing) {
      setSeatsBySection((prev) => ({ ...prev, [editing.id]: seats }));
    }
    setEditing(null);
  }

  return (
    <div className="h-full w-full">
      <div className={editing ? "hidden" : "h-full"}>
        <SectionEditor onEditSeats={handleEditSeats} />
      </div>
      {editing && (
        <div className="h-full">
          <SeatEditor
            key={editing.id}
            section={editing}
            initialSeats={seatsBySection[editing.id]}
            onExit={handleExit}
          />
        </div>
      )}
    </div>
  );
}
