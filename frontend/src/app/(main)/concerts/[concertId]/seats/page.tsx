"use client";

import { use } from "react";
import SeatViewClient from "@/components/seatview/SeatViewClient";

export default function ConcertSeatsPage({
  params,
}: {
  params: Promise<{ concertId: string }>;
}) {
  const { concertId } = use(params);
  return <SeatViewClient eventId={concertId} />;
}
