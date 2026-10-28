"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SeatDot from "@/components/seatmap/core/SeatDot";
import SectionOutline from "@/components/seatmap/core/SectionOutline";
import { getVenueLayout, parseSeatmapDoc } from "@/components/seatmap/core/seatmapApi";
import { rowSeats, seatKey } from "@/components/seatmap/core/rowGeometry";
import { Section } from "@/components/seatmap/core/types";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { useClickOrPan } from "@/components/seatmap/core/useClickOrPan";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { GradeItem, SeatKey, SeatPlanResponse, saveSeatPlan } from "@/lib/api/seatPlan";

interface Props {
  eventId: string;
  venueSeq: number;
  initialPlan: SeatPlanResponse;
}

const keyStr = (section: string, row: string, num: number) => `${section}|${row}|${num}`;

interface SeatInfo {
  id: string; // 섹션 안 seatKey 에 섹션 id 를 붙인 렌더 키
  x: number;
  y: number;
  r: number;
  section: string;
  row: string;
  number: number | null; // 건너뛰기로 번호가 없는 좌석은 null(백엔드 좌석 없음)
  available: boolean;
}

export default function EventSeatPlanEditor({ eventId, venueSeq, initialPlan }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [rowsBySection, setRowsBySection] = useState<Record<string, SeatRow[]>>({});
  const [grades, setGrades] = useState<GradeItem[]>(initialPlan.grades);
  const [sectionGrades, setSectionGrades] = useState<Record<string, string>>(initialPlan.sectionGrades);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getVenueLayout(venueSeq).then((json) => {
      if (!active) return;
      const doc = parseSeatmapDoc(json);
      setSections(doc.sections);
      setRowsBySection(doc.rowsBySection);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [venueSeq]);

  // 줄에서 계산한 좌석 + 백엔드와 일치하는 (섹션 이름, 줄 이름, 번호) 키.
  const seatInfos = useMemo<SeatInfo[]>(
    () =>
      sections.flatMap((sec) =>
        (rowsBySection[sec.id] ?? []).flatMap((row) =>
          rowSeats(row).map((s) => ({
            id: `${sec.id}:${seatKey(s.rowId, s.index)}`,
            x: s.x,
            y: s.y,
            r: s.r,
            section: sec.name,
            row: row.name.trim(), // 저장 시와 같은 이름
            number: s.number,
            available: s.available,
          })),
        ),
      ),
    [sections, rowsBySection],
  );

  // 최초 제외 집합: 등급 섹션의 가용 좌석 중 현재 sellable 이 아닌 것.
  useEffect(() => {
    if (!loaded || seatInfos.length === 0) return;
    const sellableSet = new Set(
      initialPlan.sellableSeats.map((k) => keyStr(k.section, k.rowNumber, k.seatNumber ?? 0)),
    );
    const excl = new Set<string>();
    for (const si of seatInfos) {
      if (!si.available || si.number === null) continue;
      if (!initialPlan.sectionGrades[si.section]) continue; // 비-등급 섹션은 후보 아님
      const k = keyStr(si.section, si.row, si.number);
      if (!sellableSet.has(k)) excl.add(k);
    }
    setExcludedKeys(excl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, seatInfos]);

  const addGrade = () => setGrades((g) => [...g, { grade: "", price: 0 }]);
  const removeGrade = (i: number) => setGrades((g) => g.filter((_, idx) => idx !== i));
  const patchGrade = (i: number, patch: Partial<GradeItem>) =>
    setGrades((g) => g.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const gradeNames = useMemo(() => grades.map((g) => g.grade).filter(Boolean), [grades]);

  const toggleSeat = (si: SeatInfo) => {
    // 등급 섹션의 번호 있는 가용 좌석만 토글
    if (!si.available || si.number === null || !sectionGrades[si.section]) return;
    const k = keyStr(si.section, si.row, si.number);
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // 캔버스는 로딩 중에도 마운트해 둔다(usePanZoom 의 휠 리스너가 마운트 시 붙는다).
  const pz = usePanZoom();
  const { svgProps, guardClick } = useClickOrPan(pz);

  const seatColor = (si: SeatInfo): string => {
    const grade = sectionGrades[si.section];
    if (!grade || si.number === null) return "#d1d5db"; // 미판매 섹션
    const k = keyStr(si.section, si.row, si.number);
    return excludedKeys.has(k) ? "#9ca3af" : "#34d399"; // 제외=회색, 판매=emerald
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const excludedSeats: SeatKey[] = [...excludedKeys].map((k) => {
        const [section, row, num] = k.split("|");
        return { section, rowNumber: row, seatNumber: Number(num) };
      });
      await saveSeatPlan(eventId, {
        grades: grades.filter((g) => g.grade.trim()),
        sectionGrades,
        excludedSeats,
      });
      router.push("/admin/events");
    } catch {
      setError("저장에 실패했습니다. (등급 미지정 섹션이 등급표에 없는지 확인)");
      setSaving(false);
    }
  }

  const field = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-xl border border-gray-200">
          <MapCanvas
            pz={pz}
            cursor={pz.panning ? "grabbing" : "grab"}
            svgProps={svgProps}
            overlay={
              !loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                  좌석맵 불러오는 중…
                </div>
              )
            }
          >
            {sections.map((sec) => (
              <SectionOutline key={sec.id} section={sec} />
            ))}
            {seatInfos.map((si) => {
              if (!si.available) return null; // 사용 안 함 좌석은 빈 자리
              const r = si.r;
              // 등급 섹션의 번호 있는 좌석만 이번 공연 제외 토글 대상.
              const toggleable = !!sectionGrades[si.section] && si.number !== null;
              return (
                <SeatDot
                  key={si.id}
                  x={si.x}
                  y={si.y}
                  r={r}
                  fill={seatColor(si)}
                  stroke="#ffffff"
                  strokeWidth={r * 0.16}
                  label={`${si.section} ${si.row}열 ${si.number}번`}
                  onClick={toggleable ? guardClick(() => toggleSeat(si)) : undefined}
                />
              );
            })}
          </MapCanvas>
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-bold text-gray-800">등급표</h3>
        <div className="mt-2 space-y-2">
          {grades.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={field}
                placeholder="등급명 (예: VIP)"
                value={g.grade}
                onChange={(e) => patchGrade(i, { grade: e.target.value })}
              />
              <input
                type="text"
                inputMode="numeric"
                className={field}
                placeholder="가격"
                value={g.price ? g.price.toLocaleString() : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  patchGrade(i, { price: digits ? Number(digits) : 0 });
                }}
              />
              <button
                onClick={() => removeGrade(i)}
                className="shrink-0 text-sm text-red-500 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addGrade}
          className="mt-2 rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          + 등급 추가
        </button>

        <h3 className="mt-6 text-sm font-bold text-gray-800">섹션별 등급</h3>
        <div className="mt-2 space-y-2">
          {sections.map((sec) => (
            <div key={sec.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-600">{sec.name}</span>
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={sectionGrades[sec.name] ?? ""}
                onChange={(e) =>
                  setSectionGrades((prev) => {
                    const next = { ...prev };
                    if (e.target.value) next[sec.name] = e.target.value;
                    else delete next[sec.name];
                    return next;
                  })
                }
              >
                <option value="">미판매</option>
                {gradeNames.map((gn) => (
                  <option key={gn} value={gn}>
                    {gn}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          캔버스에서 좌석 클릭 → 이번 공연 미가용 토글(회색). emerald=판매, 회색=제외, 연회색=미판매 섹션.
          드래그로 화면 이동, 휠로 확대·축소.
        </p>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </aside>
    </div>
  );
}
