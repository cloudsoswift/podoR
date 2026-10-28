"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DateBasis, TicketSummary, listMyTickets } from "@/lib/api/mytickets";
import { EventItem, getEvent } from "@/lib/api/events";
import { getRecentEventIds } from "@/lib/recentEvents";
import { formatDateTime } from "@/lib/format";

export default function MyPage() {
  const now = new Date();
  const [dateBasis, setDateBasis] = useState<DateBasis>("WATCHED");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<EventItem[]>([]);

  useEffect(() => {
    let active = true;
    // 데이터 페칭 이펙트(의도된 패턴): 조회 조건이 바뀔 때 로딩/에러 상태를 초기화하고 API 와 동기화한다
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    listMyTickets({ dateBasis, year, month })
      .then((d) => {
        if (active) setTickets(d);
      })
      .catch(() => {
        if (active) setError("예매내역을 불러오지 못했습니다. (로그인이 필요할 수 있습니다)");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dateBasis, year, month]);

  useEffect(() => {
    const ids = getRecentEventIds();
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => getEvent(id).catch(() => null))).then((list) => {
      setRecent(list.filter((e): e is EventItem => e !== null));
    });
  }, []);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2];
  }, [now]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {(["WATCHED", "BOOKED"] as DateBasis[]).map((b) => (
              <button
                key={b}
                onClick={() => setDateBasis(b)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  dateBasis === b ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600"
                }`}
              >
                {b === "WATCHED" ? "관람일" : "예매일"} 기준
              </button>
            ))}
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && tickets.length === 0 && (
          <p className="text-sm text-gray-400">해당 기간 예매내역이 없습니다.</p>
        )}
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link
              key={t.orderNumber}
              href={`/mytickets/${t.orderNumber}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{t.eventTitle}</span>
                <span className="text-xs text-gray-500">{t.status}</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">{t.venueName}</div>
              <div className="mt-1 text-xs text-gray-400">
                관람 {formatDateTime(t.eventDate)} · 예매 {formatDateTime(t.orderedAt)} · 좌석 {t.seatCount}석 · {t.totalPrice.toLocaleString()}원
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">최근 조회한 공연</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">최근 조회한 공연이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((e) => (
              <Link
                key={e.eventId}
                href={`/events/${e.eventId}`}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300"
              >
                <div className="font-semibold text-gray-900">{e.title}</div>
                <div className="mt-1 text-sm text-gray-500">{e.venueName}</div>
                <div className="mt-1 text-xs text-gray-400">{formatDateTime(e.eventDate)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
