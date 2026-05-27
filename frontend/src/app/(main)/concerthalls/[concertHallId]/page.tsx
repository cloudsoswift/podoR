"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import apiClient from "@/lib/axios";
import { ConcertHall } from "@/components/concerthall/ConcertHallCard";
import ConcertHallInfo from "@/components/concerthall/ConcertHallInfo";
import { Performance } from "@/components/performance/PerformanceCard";
import PerformanceList from "@/components/performance/PerformanceList";

export default function ConcertHallDetailPage() {
  const { concertHallId } = useParams<{ concertHallId: string }>();

  const [hall, setHall] = useState<ConcertHall | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [hallRes, perfRes] = await Promise.all([
          apiClient.get(`/concert-halls/${concertHallId}`),
          apiClient.get(`/concert-halls/${concertHallId}/performances`),
        ]);
        setHall(hallRes.data);
        setPerformances(perfRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [concertHallId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60 text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (error || !hall) {
    return (
      <div className="flex justify-center items-center h-60 text-gray-400">
        공연장 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConcertHallInfo hall={hall} />
      <PerformanceList performances={performances} />
    </div>
  );
}
