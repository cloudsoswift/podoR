"use client";

import { useState } from "react";
import { SeatViewSeat } from "@/lib/api/seatview";

interface Props {
  // 선택한 좌석(섹션 무관). 부모는 1석 이상일 때만 그린다.
  seats: SeatViewSeat[];
  checkingOut: boolean;
  onRemove(eventSeatSeq: number): void;
  onCheckout(): void;
}

const seatText = (s: SeatViewSeat) => `${s.section}(${s.grade}) - ${s.rowNumber}열 - ${s.seatNumber}번`;

/**
 * 하단 결제 바. "선택 N석"을 누르면 바 위로 선택 좌석 목록이 펼쳐져,
 * 섹션 맵이나 다른 섹션에서도 고른 좌석을 확인하고 개별로 뺄 수 있다.
 */
export default function CheckoutBar({ seats, checkingOut, onRemove, onCheckout }: Props) {
  const [open, setOpen] = useState(false);

  const sorted = [...seats].sort(
    (a, b) =>
      a.section.localeCompare(b.section) ||
      a.rowNumber.localeCompare(b.rowNumber) ||
      (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white">
      {open && (
        <ul className="mx-auto max-h-60 max-w-3xl divide-y divide-gray-100 overflow-y-auto border-b border-gray-100 px-3">
          {sorted.map((s) => {
            const text = seatText(s);
            return (
              <li key={s.eventSeatSeq} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{text}</span>
                <button
                  type="button"
                  onClick={() => onRemove(s.eventSeatSeq)}
                  aria-label={`${text} 선택 취소`}
                  className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mx-auto flex max-w-3xl items-center justify-between p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-md px-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          <span>선택 {seats.length}석</span>
          <span aria-hidden className="text-xs text-gray-400">
            {open ? "▼" : "▲"}
          </span>
        </button>
        <button
          onClick={onCheckout}
          disabled={checkingOut}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {checkingOut ? "처리 중…" : "결제하기"}
        </button>
      </div>
    </div>
  );
}
