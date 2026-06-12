"use client";

import { useCallback, useState } from "react";
import SectionEditor from "./SectionEditor";
import SeatEditor from "./SeatEditor";
import SeatmapRegisterBar from "./SeatmapRegisterBar";
import { Section } from "./types";
import { Seat } from "./seatTypes";

/**
 * 섹션 에디터와 좌석 에디터를 한 화면에서 오가는 통합 컨테이너.
 * 섹션 에디터는 항상 마운트 상태로 두고(작업 보존), 좌석 편집 중에는 숨긴다.
 * 좌석은 섹션 id 별로 보관해 다시 진입해도 이어서 편집할 수 있다.
 * 상단 바에서 섹션 배치 + 좌석을 하나의 JSON 으로 합쳐 백엔드에 등록한다.
 */
export default function SeatmapStudio() {
  const [editing, setEditing] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [seatsBySection, setSeatsBySection] = useState<Record<string, Seat[]>>(
    {},
  );

  // SectionEditor 의 effect 에서 호출되므로 참조가 안정적이어야 한다.
  const handleSectionsChange = useCallback((next: Section[]) => {
    setSections(next);
  }, []);

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
    <div className="flex h-full w-full flex-col">
      <SeatmapRegisterBar sections={sections} seatsBySection={seatsBySection} />
      <div className="min-h-0 flex-1">
        <div className={editing ? "hidden" : "h-full"}>
          <SectionEditor
            onEditSeats={handleEditSeats}
            onSectionsChange={handleSectionsChange}
          />
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
    </div>
  );
}
