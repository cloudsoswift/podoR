"use client";

import { use } from "react";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";
import StreamKeyPanel from "@/components/stream/StreamKeyPanel";

export default function HostEventStreamPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <RoleGuard roles={["HOST", "ADMIN"]}>
      <div className="space-y-4">
        <Link href="/host/events" className="text-sm text-gray-400 hover:underline">
          ← 내 공연
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">송출 관리</h1>
        <StreamKeyPanel eventId={eventId} />
      </div>
    </RoleGuard>
  );
}
