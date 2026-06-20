"use client";

import { useCallback, useEffect, useState } from "react";
import SectionEditor from "./SectionEditor";
import SeatEditor from "./SeatEditor";
import SeatmapRegisterBar from "./SeatmapRegisterBar";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import { getVenueLayout, parseSeatmapDoc } from "./seatmapApi";

interface Props {
  venueSeq: number;
}

/**
 * 섹션 에디터와 좌석 에디터를 한 화면에서 오가는 통합 컨테이너.
 * 진입 시 해당 venue 의 저장된 좌석맵(layoutJson)을 불러와 섹션+좌석을 복원한다.
 * 상단 바에서 섹션 배치 + 좌석을 하나의 JSON 으로 합쳐 백엔드에 저장한다.
 */
export default function SeatmapStudio({ venueSeq }: Props) {
  const [editing, setEditing] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [seatsBySection, setSeatsBySection] = useState<Record<string, Seat[]>>({});
  const [initialSections, setInitialSections] = useState<Section[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 저장된 좌석맵 로드 → 섹션/좌석 하이드레이트.
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const layoutJson = await getVenueLayout(venueSeq);
        if (!alive) return;
        const doc = parseSeatmapDoc(layoutJson);
        setSeatsBySection(doc.seatsBySection);
        setInitialSections(doc.sections);
      } catch {
        if (alive) setError("좌석맵을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [venueSeq]);

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        불러오는 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <SeatmapRegisterBar
        venueSeq={venueSeq}
        sections={sections}
        seatsBySection={seatsBySection}
      />
      <div className="min-h-0 flex-1">
        <div className={editing ? "hidden" : "h-full"}>
          <SectionEditor
            initialSections={initialSections ?? undefined}
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
