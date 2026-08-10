"use client";

import { useEffect, useState } from "react";
import VenueList from "@/components/venue/VenueList";
import { Venue } from "@/components/venue/VenueCard";
import { listVenues } from "@/lib/api/venues";

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listVenues({ page: 0, size: 50, sort: "name,asc" })
      .then((d) => {
        if (active) setVenues(d.content);
      })
      .catch(() => {
        if (active) setError("공연장 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">공연장</h1>
      {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && venues.length === 0 && (
        <p className="text-sm text-gray-400">등록된 공연장이 없습니다.</p>
      )}
      {venues.length > 0 && <VenueList venues={venues} />}
    </div>
  );
}
