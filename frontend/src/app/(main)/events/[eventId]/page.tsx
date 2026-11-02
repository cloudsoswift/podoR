"use client";

import { use, useEffect, useState } from "react";
import SessionList from "@/components/event/SessionList";
import { EventItem, getEvent, listSessions } from "@/lib/api/events";
import { pushRecentEvent } from "@/lib/recentEvents";
import { getWatchableEventIds } from "@/lib/api/stream";
import { useAuthStore } from "@/store/authStore";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [sessions, setSessions] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watchable, setWatchable] = useState<Set<string>>(new Set());
  const loggedIn = useAuthStore((s) => Boolean(s.accessToken));

  useEffect(() => {
    let active = true;
    pushRecentEvent(eventId);   // 최근 조회 기록
    getEvent(eventId)
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
  }, [eventId]);

  // 내가 예매한 회차에 "관람하기"를 보인다. 실패하면 버튼만 안 보인다.
  const seriesId = event?.seriesId;
  useEffect(() => {
    if (!loggedIn || !seriesId) return;
    let active = true;
    getWatchableEventIds(seriesId)
      .then((ids) => {
        if (active) setWatchable(new Set(ids));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [loggedIn, seriesId]);

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
        <SessionList sessions={sessions} watchableIds={watchable} />
      </div>
    </div>
  );
}
