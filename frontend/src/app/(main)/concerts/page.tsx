"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConcertSummary, listConcerts } from "@/lib/api/events";
import { formatDateTime } from "@/lib/format";

export default function ConcertsPage() {
  const [items, setItems] = useState<ConcertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listConcerts({ page: 0, size: 50, sort: "eventDate,asc" })
      .then((d) => {
        if (active) setItems(d.content);
      })
      .catch(() => {
        if (active) setError("공연 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">공연</h1>
      {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link
            key={c.seriesId}
            href={`/concerts/${c.representativeEventId}`}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="text-lg font-bold text-gray-900">{c.title}</div>
            <div className="mt-1 text-sm text-gray-500">{c.venueName}</div>
            <div className="mt-1 text-xs text-gray-400">{formatDateTime(c.earliestEventDate)}</div>
            {c.sessionCount > 1 && (
              <div className="mt-2 inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                {c.sessionCount}개 회차
              </div>
            )}
          </Link>
        ))}
      </div>
      {!loading && items.length === 0 && <p className="text-sm text-gray-400">등록된 공연이 없습니다.</p>}
    </div>
  );
}
