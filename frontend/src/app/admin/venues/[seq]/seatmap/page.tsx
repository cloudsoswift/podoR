"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import SeatmapStudio from "@/components/seatmap/SeatmapStudio";
import { getVenue } from "@/lib/api/venues";

export default function VenueSeatmapPage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = use(params);
  const venueSeq = Number(seq);
  const [venueName, setVenueName] = useState<string>("");

  useEffect(() => {
    let active = true;
    getVenue(venueSeq)
      .then((v) => {
        if (active) setVenueName(v.name);
      })
      .catch(() => {
        // 이름 조회 실패는 치명적이지 않다 — seq 만 표시한다.
      });
    return () => {
      active = false;
    };
  }, [venueSeq]);

  return (
    <div className="-m-8 flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/venues"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            ← 공연장 목록
          </Link>
          <h1 className="text-lg font-bold text-gray-900">
            좌석맵 편집{venueName ? ` — ${venueName}` : ` (#${venueSeq})`}
          </h1>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <SeatmapStudio venueSeq={venueSeq} />
      </div>
    </div>
  );
}
