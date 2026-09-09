"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSeatViewPolling } from "./useSeatViewPolling";
import { parseSeatmapDoc } from "@/components/seatmap/seatmapApi";
import { holdSeats, getMySeatQuota } from "@/lib/api/ticketing";

/**
 * Section Viewer(섹션 미선택) ↔ SeatMap Viewer(섹션 선택)를 한 화면에서 오간다.
 * 좌석 선택(클라 상태) 후 "결제하기" 로 일괄 선점(Redis) → 결제 페이지로 이동.
 * SOLD/타인 선점(held) 좌석은 클릭 불가.
 */
export default function SeatViewClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [section, setSection] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [quota, setQuota] = useState<{ used: number; max: number } | null>(null);
  const [cooling, setCooling] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { seats, layoutJson, heldSeats, loading, refresh } = useSeatViewPolling(eventId, section);

  const loadQuota = useCallback(() => {
    getMySeatQuota(eventId).then(setQuota).catch(() => {});
  }, [eventId]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);
  const doc = useMemo(() => parseSeatmapDoc(layoutJson), [layoutJson]);
  const heldSet = useMemo(() => new Set(heldSeats), [heldSeats]);

  const bySection = useMemo(() => {
    const m = new Map<string, { total: number; available: number }>();
    for (const s of seats) {
      const e = m.get(s.section) ?? { total: 0, available: 0 };
      e.total++;
      if (s.status === "AVAILABLE" && !heldSet.has(s.eventSeatSeq)) e.available++;
      m.set(s.section, e);
    }
    return m;
  }, [seats, heldSet]);

  function toggleSeat(seq: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) {
        next.delete(seq);
        return next;
      }
      if (quota) {
        const remaining = quota.max - quota.used; // 이미 쓴(선점+예매) 좌석 제외 잔여
        if (next.size >= remaining) {
          alert(`이 공연은 1인 최대 ${quota.max}석까지 예매할 수 있습니다.`);
          return prev;
        }
      }
      next.add(seq);
      return next;
    });
  }

  async function handleCheckout() {
    const seqs = [...selected];
    if (seqs.length === 0 || checkingOut) return; // 연타로 중복 선점/이동하지 않도록
    setCheckingOut(true);
    try {
      await holdSeats(eventId, seqs);
      // 선점되면 그 좌석은 클릭 불가(held)가 되어 선택 해제도 못 한다.
      // 선택을 비워 "결제 바만 남고 빠져나올 수 없는" 상태를 막는다.
      // (결제 페이지는 URL 쿼리로 좌석을 받으므로 흐름에는 영향 없다.)
      setSelected(new Set());
      router.push(`/events/${eventId}/seats/payment?seats=${seqs.join(",")}`);
    } catch {
      alert("선택한 좌석 중 일부를 예매할 수 없습니다. 좌석 현황을 다시 확인해주세요.");
      setSelected(new Set());
      loadQuota();
    } finally {
      setCheckingOut(false);
    }
  }

  function handleRefresh() {
    if (cooling) return;
    setCooling(true);
    refresh();
    loadQuota();
    setTimeout(() => setCooling(false), 3000);
  }

  const checkoutBar =
    selected.size > 0 ? (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm text-gray-700">선택 {selected.size}석</span>
          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {checkingOut ? "처리 중…" : "결제하기"}
          </button>
        </div>
      </div>
    ) : null;

  // 페이지 흐름 안에 배치한다. fixed 로 띄우면 sticky 헤더(z-50, 불투명)에 가려진다.
  const quotaBadge = quota ? (
    <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
      현재 {quota.used} / {quota.max}
    </span>
  ) : null;

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!section) {
    return (
      <div className="p-4 pb-20">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">섹션 선택</h2>
          {quotaBadge}
        </div>
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
        {checkoutBar}
      </div>
    );
  }

  const sectionSeats = seats
    .filter((s) => s.section === section)
    .sort((a, b) => a.rowNumber.localeCompare(b.rowNumber) || (a.seatNumber ?? 0) - (b.seatNumber ?? 0));

  return (
    <div className="p-4 pb-20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => setSection(undefined)} className="text-sm text-indigo-600 hover:underline">
          ← 전체 섹션
        </button>
        <div className="flex items-center gap-2">
          {quotaBadge}
          <button
            onClick={handleRefresh}
            disabled={cooling}
            className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {cooling ? "새로고침 대기…" : "새로고침"}
          </button>
        </div>
      </div>
      <h2 className="mb-3 text-lg font-bold text-gray-900">{section}</h2>
      <div className="flex flex-wrap gap-1">
        {sectionSeats.map((s) => {
          const sold = s.status === "SOLD";
          const held = heldSet.has(s.eventSeatSeq);
          const isSelected = selected.has(s.eventSeatSeq);
          const clickable = !sold && !held;
          let cls = "bg-emerald-400 text-white";
          if (sold) cls = "bg-gray-300 text-gray-500";
          else if (held) cls = "bg-amber-300 text-amber-800";
          else if (isSelected) cls = "bg-indigo-600 text-white ring-2 ring-indigo-300";
          return (
            <button
              key={s.eventSeatSeq}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && toggleSeat(s.eventSeatSeq)}
              title={`${s.rowNumber}${s.seatNumber ?? ""} · ${s.grade} · ${s.price.toLocaleString()}원`}
              className={`flex h-7 w-7 items-center justify-center rounded text-[9px] ${cls} disabled:cursor-not-allowed`}
            >
              {s.rowNumber}
            </button>
          );
        })}
      </div>
      {sectionSeats.length === 0 && <p className="text-sm text-gray-400">이 섹션에 판매 좌석이 없습니다.</p>}
      <div className="mt-4 flex gap-3 text-xs text-gray-500">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-400 align-middle" />예매가능</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-300 align-middle" />선점중</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-gray-300 align-middle" />판매완료</span>
      </div>
      {checkoutBar}
    </div>
  );
}
