"use client";

import { useCallback, useEffect, useState } from "react";
import SectionEditor from "./SectionEditor";
import RowEditor from "./RowEditor";
import SeatmapRegisterBar from "./SeatmapRegisterBar";
import { BackgroundImage, Section } from "@/components/seatmap/core/types";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { translateRows } from "@/components/seatmap/core/rowGeometry";
import { getVenueLayout, parseSeatmapDoc } from "@/components/seatmap/core/seatmapApi";

interface Props {
  venueSeq: number;
}

/**
 * 섹션 에디터와 줄 에디터를 한 화면에서 오가는 통합 컨테이너.
 * 진입 시 해당 venue 의 저장된 좌석맵(layoutJson)을 불러와 섹션+줄을 복원한다.
 * 섹션 에디터의 밑그림을 줄 에디터에도 보여 주고, 섹션을 옮기면 그 섹션의 줄도 함께 옮긴다.
 * 상단 바에서 섹션 배치 + 줄을 하나의 JSON 으로 합쳐 백엔드에 저장한다.
 */
export default function SeatmapStudio({ venueSeq }: Props) {
  const [editing, setEditing] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [rowsBySection, setRowsBySection] = useState<Record<string, SeatRow[]>>({});
  const [background, setBackground] = useState<BackgroundImage | null>(null);
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
        setRowsBySection(doc.rowsBySection);
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

  // 섹션 평행 이동을 그 섹션의 줄에도 반영한다(모양 편집은 따라가지 않음).
  const handleSectionMove = useCallback((id: string, dx: number, dy: number) => {
    setRowsBySection((prev) =>
      prev[id] ? { ...prev, [id]: translateRows(prev[id], null, dx, dy) } : prev,
    );
  }, []);

  // 편집 중인 섹션의 줄을 실시간으로 반영한다(상단 저장 바가 최신 줄로 검증·저장).
  const editingId = editing?.id;
  const handleRowsChange = useCallback(
    (rows: SeatRow[]) => {
      if (editingId) setRowsBySection((prev) => ({ ...prev, [editingId]: rows }));
    },
    [editingId],
  );

  function handleEditSeats(section: Section) {
    setEditing(section);
  }

  function handleExit(rows: SeatRow[]) {
    if (editing) {
      const id = editing.id;
      setRowsBySection((prev) => ({ ...prev, [id]: rows }));
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
        rowsBySection={rowsBySection}
      />
      <div className="min-h-0 flex-1">
        <div className={editing ? "hidden" : "h-full"}>
          <SectionEditor
            initialSections={initialSections ?? undefined}
            onEditSeats={handleEditSeats}
            onSectionsChange={handleSectionsChange}
            onBackgroundChange={setBackground}
            onSectionMove={handleSectionMove}
            keyboardEnabled={!editing}
          />
        </div>
        {editing && (
          <div className="h-full">
            <RowEditor
              key={editing.id}
              section={editing}
              initialRows={rowsBySection[editing.id]}
              background={background}
              onExit={handleExit}
              onRowsChange={handleRowsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
