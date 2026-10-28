"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TicketDetail, TicketSeat, getMyTicket } from "@/lib/api/mytickets";
import { cancelOrder, cancelOrderItems } from "@/lib/api/ticketing";
import { formatDateTime } from "@/lib/format";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const STATUS_LABEL: Record<string, string> = {
  PAID: "결제 완료",
  PARTIALLY_CANCELLED: "부분 취소",
  CANCELLED: "취소 완료",
};

const seatLabel = (s: TicketSeat) => `${s.section} ${s.rowNumber}열 ${s.seatNumber ?? ""}번`;

export default function MyTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 부분 취소할 좌석(itemSeq)과 확인 창 상태
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(
    () =>
      getMyTicket(ticketId).then((t) => {
        setTicket(t);
        setSelected(new Set());
      }),
    [ticketId],
  );

  async function handleCancel() {
    if (!ticket || !confirm("남은 좌석을 모두 취소하시겠어요?")) return;
    try {
      await cancelOrder(ticket.eventId, ticket.orderNumber);
      router.replace("/mypage");
    } catch {
      alert("예매 취소에 실패했습니다.");
    }
  }

  async function handlePartialCancel() {
    if (!ticket) return;
    setCancelling(true);
    try {
      await cancelOrderItems(ticket.eventId, ticket.orderNumber, [...selected]);
      setConfirmOpen(false);
      await load();
    } catch {
      alert("좌석 취소에 실패했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  function toggle(itemSeq: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemSeq)) next.delete(itemSeq);
      else next.add(itemSeq);
      return next;
    });
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

  const cancellable = ticket.status === "PAID" || ticket.status === "PARTIALLY_CANCELLED";
  const selectedSeats = ticket.seats.filter((s) => selected.has(s.itemSeq));
  const refund = selectedSeats.reduce((sum, s) => sum + s.price, 0);

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
        <div className="flex justify-between py-1"><dt className="text-gray-500">예매상태</dt><dd className="text-gray-900">{STATUS_LABEL[ticket.status] ?? ticket.status}</dd></div>
        {ticket.cancelledAt && (
          <div className="flex justify-between py-1"><dt className="text-gray-500">취소일</dt><dd className="text-gray-900">{formatDateTime(ticket.cancelledAt)}</dd></div>
        )}
        <div className="flex justify-between py-1"><dt className="text-gray-500">총 금액</dt><dd className="text-gray-900">{ticket.totalPrice.toLocaleString()}원</dd></div>
      </dl>

      <div>
        <h2 className="mb-2 text-lg font-bold text-gray-900">좌석</h2>
        <ul className="space-y-2">
          {ticket.seats.map((s) => {
            const active = s.status === "PAID";
            return (
              <li
                key={s.itemSeq}
                className={`flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm ${active ? "" : "opacity-50"}`}
              >
                <label className="flex items-center gap-2">
                  {cancellable && active && (
                    <input
                      type="checkbox"
                      aria-label={seatLabel(s)}
                      checked={selected.has(s.itemSeq)}
                      onChange={() => toggle(s.itemSeq)}
                    />
                  )}
                  <span className="text-gray-800">{seatLabel(s)}</span>
                </label>
                <span className="text-gray-500">
                  {active
                    ? `${s.grade} · ${s.price.toLocaleString()}원`
                    : `취소됨 · ${formatDateTime(s.cancelledAt)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {cancellable && (
        <div className="space-y-2">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selected.size === 0}
            className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            선택한 좌석 취소
          </button>
          <button
            onClick={handleCancel}
            className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            예매 취소
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="선택한 좌석을 취소할까요?"
        description={`${selectedSeats.map(seatLabel).join(", ")} — 환불 금액 ${refund.toLocaleString()}원`}
        confirmText="좌석 취소"
        cancelText="닫기"
        loading={cancelling}
        onConfirm={handlePartialCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
