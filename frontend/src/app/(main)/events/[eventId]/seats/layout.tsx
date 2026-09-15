"use client";

import { ReactNode, use } from "react";
import QueueGate from "@/components/queue/QueueGate";

/**
 * 좌석 선택과 결제가 공유하는 레이아웃. 레이아웃은 자식 라우트끼리 이동할 때 언마운트되지 않으므로
 * 좌석 → 결제 이동에도 입장 상태가 유지되고, 이 레이아웃이 언마운트되면 = 좌석 플로우를 떠난 것이다.
 */
export default function SeatsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  return <QueueGate eventId={eventId}>{children}</QueueGate>;
}
