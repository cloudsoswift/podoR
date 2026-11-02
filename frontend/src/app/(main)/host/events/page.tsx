"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";
import EventFormModal from "@/components/admin/EventFormModal";
import { createEvent, EventItem, EventUpdatePayload } from "@/lib/api/events";
import { listHostedEvents } from "@/lib/api/stream";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "송출 전",
  LIVE: "방송 중",
  INTERRUPTED: "끊김",
  ENDED: "종료",
};

function HostEvents() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await listHostedEvents());
    } catch {
      setError("내 공연을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleCreate = async (payload: EventUpdatePayload) => {
    await createEvent(payload);
    setCreating(false);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 공연</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
        >
          회차 등록
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {events === null && !error && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {events?.length === 0 && <p className="text-sm text-gray-400">등록한 회차가 없습니다.</p>}

      <ul className="space-y-2">
        {events?.map((e) => (
          <li
            key={e.eventId}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-gray-900">{e.title}</p>
              <p className="text-sm text-gray-500">
                {formatDateTime(e.eventDate)} · {e.venueName} · {STATUS_LABEL[e.streamStatus ?? "SCHEDULED"] ?? e.streamStatus}
              </p>
            </div>
            <Link
              href={`/host/events/${e.eventId}/stream`}
              className="rounded-lg border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              송출 관리
            </Link>
          </li>
        ))}
      </ul>

      <EventFormModal
        open={creating}
        event={null}
        venueSearchPath="/host/venues/search"
        onSubmit={handleCreate}
        onCancel={() => setCreating(false)}
      />
    </div>
  );
}

export default function HostEventsPage() {
  return (
    <RoleGuard roles={["HOST", "ADMIN"]}>
      <HostEvents />
    </RoleGuard>
  );
}
