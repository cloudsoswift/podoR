"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EventItem, getEvent, listSessions } from "@/lib/api/events";
import { formatDateTime } from "@/lib/format";

export default function ConcertDetailPage({
  params,
}: {
  params: Promise<{ concertId: string }>;
}) {
  const { concertId } = use(params);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [sessions, setSessions] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEvent(concertId)
      .then((ev) => {
        if (!active) return;
        setEvent(ev);
        return listSessions(ev.seriesId);
      })
      .then((sess) => {
        if (active && sess) setSessions(sess);
      })
      .catch(() => {
        if (active) setError("공연 정보를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [concertId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!event) return <p className="text-sm text-gray-500">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{event.venueName}</p>
        {event.content && <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{event.content}</p>}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold text-gray-900">회차 선택</h2>
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link
              key={s.eventId}
              href={`/concerts/${s.eventId}/seats`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-indigo-300"
            >
              <span className="text-sm font-medium text-gray-800">{formatDateTime(s.eventDate)}</span>
              <span className="text-sm text-indigo-600">좌석 보기 →</span>
            </Link>
          ))}
          {sessions.length === 0 && <p className="text-sm text-gray-400">회차 정보가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
