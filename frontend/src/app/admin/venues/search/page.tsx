"use client";

import { useEffect, useMemo, useState } from "react";
import { listVenues, Venue } from "@/lib/api/venues";

export default function VenueSearchPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listVenues({ page: 0, size: 200 })
      .then((d) => setVenues(d.content))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return venues;
    return venues.filter(
      (v) => v.name.toLowerCase().includes(k) || (v.address ?? "").toLowerCase().includes(k),
    );
  }, [venues, keyword]);

  const pick = (v: Venue) => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "venue-picked", seq: v.seq, name: v.name },
        window.location.origin,
      );
      window.close();
    }
  };

  const hasOpener = typeof window !== "undefined" && !!window.opener;

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-bold text-gray-900">공연장 검색</h1>
      {!hasOpener && (
        <p className="mb-2 text-xs text-amber-600">이 창은 이벤트 폼에서 열어야 선택이 반영됩니다.</p>
      )}
      <input
        autoFocus
        className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        placeholder="이름 또는 주소 검색"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {filtered.map((v) => (
            <li key={v.seq}>
              <button
                onClick={() => pick(v)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-indigo-50"
              >
                <span className="text-sm font-medium text-gray-800">{v.name}</span>
                <span className="text-xs text-gray-500">{v.address}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-gray-400">검색 결과 없음</li>}
        </ul>
      )}
    </div>
  );
}
