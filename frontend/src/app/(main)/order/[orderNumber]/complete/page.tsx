"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TicketDetail, getMyTicket } from "@/lib/api/mytickets";
import { formatDateTime } from "@/lib/format";

export default function OrderCompletePage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyTicket(orderNumber)
      .then((t) => {
        if (active) setTicket(t);
      })
      .catch(() => {
        if (active) setError("주문 정보를 불러올 수 없습니다.");
      });
    return () => {
      active = false;
    };
  }, [orderNumber]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ticket) return <p className="text-sm text-gray-500">불러오는 중…</p>;

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <div className="rounded-xl bg-emerald-50 p-4 text-center">
        <p className="text-lg font-bold text-emerald-700">예매가 완료되었습니다 🎉</p>
        <p className="mt-1 text-xs text-emerald-600">예매번호 {ticket.orderNumber}</p>
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{ticket.eventTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{ticket.venueName}</p>
        <p className="mt-1 text-sm text-gray-400">관람 {formatDateTime(ticket.eventDate)}</p>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-bold text-gray-900">좌석</h2>
        <div className="space-y-2">
          {ticket.seats.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
              <span className="text-gray-800">{s.section} {s.rowNumber}열 {s.seatNumber ?? ""}번</span>
              <span className="text-gray-500">{s.grade} · {s.price.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">총 결제금액</span>
        <span className="font-bold text-gray-900">{ticket.totalPrice.toLocaleString()}원</span>
      </div>
      <div className="flex gap-2">
        <Link href="/mypage" className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-200">마이페이지</Link>
        <Link href="/events" className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700">공연 더 보기</Link>
      </div>
    </div>
  );
}
