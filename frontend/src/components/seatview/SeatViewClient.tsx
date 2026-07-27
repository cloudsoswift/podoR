"use client";

import { useMemo, useState } from "react";
import { useSeatViewPolling } from "./useSeatViewPolling";
import { parseSeatmapDoc } from "@/components/seatmap/seatmapApi";

/**
 * Section Viewer(섹션 미선택) ↔ SeatMap Viewer(섹션 선택)를 한 화면에서 오간다.
 * 증분 폴링으로 좌석 상태를 갱신한다. (Flow 5 예매는 Phase 2)
 */
export default function SeatViewClient({ eventId }: { eventId: string }) {
  const [section, setSection] = useState<string | undefined>(undefined);
  const { seats, layoutJson, loading } = useSeatViewPolling(eventId, section);
  const doc = useMemo(() => parseSeatmapDoc(layoutJson), [layoutJson]);

  const bySection = useMemo(() => {
    const m = new Map<string, { total: number; available: number }>();
    for (const s of seats) {
      const e = m.get(s.section) ?? { total: 0, available: 0 };
      e.total++;
      if (s.status === "AVAILABLE") e.available++;
      m.set(s.section, e);
    }
    return m;
  }, [seats]);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!section) {
    // Section Viewer: 섹션별 잔여석
    return (
      <div className="p-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">섹션 선택</h2>
        <div className="flex flex-wrap gap-2">
          {doc.sections.map((sec) => {
            const agg = bySection.get(sec.name) ?? { total: 0, available: 0 };
            const soldOut = agg.total > 0 && agg.available === 0;
            return (
              <button
                key={sec.id}
                onClick={() => setSection(sec.name)}
                disabled={agg.total === 0}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  soldOut ? "border-gray-200 bg-gray-100 text-gray-400" : "border-indigo-200 hover:bg-indigo-50"
                } disabled:opacity-40`}
              >
                <div className="font-medium" style={{ color: sec.color }}>
                  {sec.name}
                </div>
                <div className="text-xs text-gray-500">
                  잔여 {agg.available}/{agg.total}
                </div>
              </button>
            );
          })}
        </div>
        {doc.sections.length === 0 && (
          <p className="text-sm text-gray-400">좌석맵이 등록되지 않은 공연입니다.</p>
        )}
      </div>
    );
  }

  // SeatMap Viewer: 해당 섹션 좌석 개별
  const sectionSeats = seats
    .filter((s) => s.section === section)
    .sort((a, b) => a.rowNumber.localeCompare(b.rowNumber) || (a.seatNumber ?? 0) - (b.seatNumber ?? 0));

  return (
    <div className="p-4">
      <button onClick={() => setSection(undefined)} className="mb-3 text-sm text-indigo-600 hover:underline">
        ← 전체 섹션
      </button>
      <h2 className="mb-3 text-lg font-bold text-gray-900">{section}</h2>
      <div className="flex flex-wrap gap-1">
        {sectionSeats.map((s) => (
          <div
            key={s.eventSeatSeq}
            title={`${s.rowNumber}${s.seatNumber ?? ""} · ${s.grade} · ${s.price.toLocaleString()}원`}
            className={`flex h-7 w-7 items-center justify-center rounded text-[9px] ${
              s.status === "AVAILABLE" ? "bg-emerald-400 text-white" : "bg-gray-300 text-gray-500"
            }`}
          >
            {s.rowNumber}
          </div>
        ))}
      </div>
      {sectionSeats.length === 0 && <p className="text-sm text-gray-400">이 섹션에 판매 좌석이 없습니다.</p>}
      <p className="mt-4 text-xs text-gray-400">좌석 선택·예매는 다음 단계(Phase 2)에서 제공됩니다.</p>
    </div>
  );
}
