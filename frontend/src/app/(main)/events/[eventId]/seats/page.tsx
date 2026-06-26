"use client";

import { use } from "react";
import SeatViewClient from "@/components/seatview/SeatViewClient";

export default function EventSeatsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  return <SeatViewClient eventId={eventId} />;
}
