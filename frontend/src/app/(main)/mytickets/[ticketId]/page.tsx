"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TicketDetail, getMyTicket } from "@/lib/api/mytickets";
import { cancelOrder } from "@/lib/api/ticketing";
import { formatDateTime } from "@/lib/format";

export default function MyTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!ticket || !confirm("예매를 취소하시겠어요?")) return;
    try {
      await cancelOrder(ticket.eventId, ticket.orderNumber);
      router.replace("/mypage");
    } catch {
      alert("예매 취소에 실패했습니다.");
    }
  }

  useEffect(() => {
    let active = true;
    getMyTicket(ticketId)
      .then((t) => {
        if (active) setTicket(t);
      })
      .catch(() => {
        if (active) setError("예매 정보를 불러올 수 없습니다.");
      });
    return () => {
      active = false;
    };
  }, [ticketId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ticket) return <p className="text-sm text-gray-500">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <Link href="/mypage" className="text-sm text-indigo-600 hover:underline">← 마이페이지</Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{ticket.eventTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{ticket.venueName}</p>
        <p className="mt-1 text-sm text-gray-400">관람 {formatDateTime(ticket.eventDate)}</p>
      </div>

      <dl className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <div className="flex justify-between py-1"><dt className="text-gray-500">예매번호</dt><dd className="text-gray-900">{ticket.orderNumber}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-gray-500">예매일</dt><dd className="text-gray-900">{formatDateTime(ticket.orderedAt)}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-gray-500">예매상태</dt><dd className="text-gray-900">{ticket.status}</dd></div>
        {ticket.cancelledAt && (
          <div className="flex justify-between py-1"><dt className="text-gray-500">취소일</dt><dd className="text-gray-900">{formatDateTime(ticket.cancelledAt)}</dd></div>
        )}
        <div className="flex justify-between py-1"><dt className="text-gray-500">총 금액</dt><dd className="text-gray-900">{ticket.totalPrice.toLocaleString()}원</dd></div>
      </dl>

      <div>
        <h2 className="mb-2 text-lg font-bold text-gray-900">좌석</h2>
        <div className="space-y-2">
          {ticket.seats.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
              <span className="text-gray-800">{s.section} {s.rowNumber}열 {s.seatNumber ?? ""}번</span>
              <span className="text-gray-500">{s.grade} · {s.price.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      </div>

      {ticket.status === "PAID" && (
        <button
          onClick={handleCancel}
          className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          예매 취소
        </button>
      )}
    </div>
  );
}
