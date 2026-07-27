"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import EventSeatPlanEditor from "@/components/seatplan/EventSeatPlanEditor";
import { getEvent } from "@/lib/api/events";
import { getSeatPlan, SeatPlanResponse } from "@/lib/api/seatPlan";

export default function EventSeatPlanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [venueSeq, setVenueSeq] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [plan, setPlan] = useState<SeatPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getEvent(eventId), getSeatPlan(eventId)])
      .then(([ev, p]) => {
        if (!active) return;
        setVenueSeq(ev.venueSeq);
        setTitle(ev.title);
        setPlan(p);
      })
      .catch(() => {
        if (active) setError("좌석 플랜을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <div className="-m-8 flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/events" className="text-sm font-medium text-indigo-600 hover:underline">
            ← 이벤트 목록
          </Link>
          <h1 className="text-lg font-bold text-gray-900">
            좌석 플랜{title ? ` — ${title}` : ""}
          </h1>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {venueSeq != null && plan && (
          <EventSeatPlanEditor eventId={eventId} venueSeq={venueSeq} initialPlan={plan} />
        )}
      </div>
    </div>
  );
}
