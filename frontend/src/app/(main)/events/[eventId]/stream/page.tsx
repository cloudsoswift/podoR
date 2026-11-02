"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import StreamViewer from "@/components/stream/StreamViewer";
import { EventItem, getEvent } from "@/lib/api/events";
import { formatDateTime } from "@/lib/format";

export default function EventStreamPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    let active = true;
    getEvent(eventId)
      .then((ev) => {
        if (active) setEvent(ev);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <div className="space-y-4">
      <Link href={`/events/${eventId}`} className="text-sm text-indigo-600 hover:underline">
        ← 공연 정보
      </Link>
      {event && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {event.venueName} · {formatDateTime(event.eventDate)}
          </p>
        </div>
      )}
      <StreamViewer eventId={eventId} />
    </div>
  );
}
