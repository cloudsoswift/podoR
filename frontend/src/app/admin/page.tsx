"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/admin/StatCard";
import { listUsers } from "@/lib/api/adminUsers";
import { listVenues } from "@/lib/api/venues";
import { listEvents } from "@/lib/api/events";

interface Counts {
  users: number;
  venues: number;
  events: number;
}

export default function AdminOverviewPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // size=1 로 호출해 totalElements 만 사용
        const [u, v, e] = await Promise.all([
          listUsers({ page: 0, size: 1 }),
          listVenues({ page: 0, size: 1 }),
          listEvents({ page: 0, size: 1 }),
        ]);
        if (!active) return;
        setCounts({
          users: u.totalElements,
          venues: v.totalElements,
          events: e.totalElements,
        });
      } catch {
        if (active) setError("통계를 불러오지 못했습니다.");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">개요</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="전체 사용자" value={counts?.users ?? "—"} href="/admin/users" />
        <StatCard label="전체 공연장" value={counts?.venues ?? "—"} href="/admin/venues" />
        <StatCard label="전체 이벤트" value={counts?.events ?? "—"} href="/admin/events" />
      </div>
    </div>
  );
}
