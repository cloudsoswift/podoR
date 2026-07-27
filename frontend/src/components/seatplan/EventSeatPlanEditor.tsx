"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getVenueLayout, parseSeatmapDoc } from "@/components/seatmap/seatmapApi";
import { rowLabel } from "@/components/seatmap/seatGeometry";
import { Section } from "@/components/seatmap/types";
import { Seat } from "@/components/seatmap/seatTypes";
import { GradeItem, SeatKey, SeatPlanResponse, saveSeatPlan } from "@/lib/api/seatPlan";

interface Props {
  eventId: string;
  venueSeq: number;
  initialPlan: SeatPlanResponse;
}

const VIEW_W = 1000;
const VIEW_H = 700;

const keyStr = (section: string, row: string, num: number) => `${section}|${row}|${num}`;

interface SeatInfo {
  x: number;
  y: number;
  section: string;
  row: string;
  number: number;
  available: boolean;
}

export default function EventSeatPlanEditor({ eventId, venueSeq, initialPlan }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [seatsBySection, setSeatsBySection] = useState<Record<string, Seat[]>>({});
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
      setSeatsBySection(doc.seatsBySection);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [venueSeq]);

  // 좌석맵 좌표 + 백엔드와 일치하는 (section,row,number) 키.
  const seatInfos = useMemo<SeatInfo[]>(() => {
    const out: SeatInfo[] = [];
    for (const sec of sections) {
      const secSeats = seatsBySection[sec.id] ?? [];
      const rowsPresent = [...new Set(secSeats.map((s) => s.gridRow))].sort((a, b) => a - b);
      const labelByRow = new Map(rowsPresent.map((gr, i) => [gr, rowLabel(i)]));
      for (const s of secSeats) {
        out.push({
          x: s.x,
          y: s.y,
          section: sec.name,
          row: labelByRow.get(s.gridRow) ?? "A",
          number: s.number,
          available: s.available,
        });
      }
    }
    return out;
  }, [sections, seatsBySection]);

  // 최초 제외 집합: 등급 섹션의 가용 좌석 중 현재 sellable 이 아닌 것.
  useEffect(() => {
    if (!loaded || seatInfos.length === 0) return;
    const sellableSet = new Set(
      initialPlan.sellableSeats.map((k) => keyStr(k.section, k.rowNumber, k.seatNumber ?? 0)),
    );
    const excl = new Set<string>();
    for (const si of seatInfos) {
      if (!si.available) continue;
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
    if (!si.available || !sectionGrades[si.section]) return; // 등급 섹션의 가용 좌석만 토글
    const k = keyStr(si.section, si.row, si.number);
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const seatColor = (si: SeatInfo): string => {
    if (!si.available) return "transparent"; // 비가용 좌석은 빈 자리
    const grade = sectionGrades[si.section];
    if (!grade) return "#e5e7eb"; // 미판매 섹션
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
      <div className="min-w-0 flex-1 overflow-auto p-4">
        {!loaded ? (
          <div className="text-sm text-gray-500">좌석맵 불러오는 중…</div>
        ) : (
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full rounded-xl border border-gray-200 bg-white">
            {seatInfos.map((si, i) => {
              const color = seatColor(si);
              if (color === "transparent") return null;
              return (
                <circle
                  key={i}
                  cx={si.x}
                  cy={si.y}
                  r={4}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{ cursor: si.available && sectionGrades[si.section] ? "pointer" : "default" }}
                  onClick={() => toggleSeat(si)}
                />
              );
            })}
          </svg>
        )}
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
                type="number"
                className={field}
                placeholder="가격"
                value={g.price}
                onChange={(e) => patchGrade(i, { price: Number(e.target.value) })}
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
