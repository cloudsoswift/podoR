"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { failPayment } from "@/lib/api/ticketing";
import { clearPaymentRedirect } from "@/lib/paymentRedirect";

/** 토스가 사용자 취소에 주는 코드 */
const USER_CANCELED = "PAY_PROCESS_CANCELED";

/**
 * 토스 failUrl. 쿼리(orderNumber, seats 는 우리가, code, message 는 토스가 붙인다)로 실패를 기록하고
 * 사유를 보여준다. 서버는 실패를 기록해도 선점을 유지한다("다시 결제하기"가 가능하도록).
 */
export default function PaymentFailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const search = useSearchParams();
  const orderNumber = search.get("orderNumber") ?? "";
  const code = search.get("code") ?? "";
  const message = search.get("message") ?? "";
  // 링크에 그대로 넣으므로 숫자·쉼표만 남긴다(이 URL 은 누구나 조립할 수 있다).
  const seats = (search.get("seats") ?? "")
    .split(",")
    .filter((s) => /^\d+$/.test(s))
    .join(",");

  // 실패 기록은 한 번만(StrictMode effect 재실행 대비). 실패해도 화면은 그대로 — 방치 주문은 만료 스케줄러가 정리한다.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    clearPaymentRedirect(eventId);
    if (orderNumber) failPayment(eventId, orderNumber, { code, message }).catch(() => {});
  }, [eventId, orderNumber, code, message]);

  const reason = code === USER_CANCELED ? "결제를 취소했습니다." : message || "결제에 실패했습니다.";

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">결제</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <p className="text-gray-900">{reason}</p>
      </div>
      <div className="flex gap-3">
        {seats && (
          <Link
            href={`/events/${eventId}/seats/payment?seats=${seats}`}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-indigo-700"
          >
            다시 결제하기
          </Link>
        )}
        <Link
          href={`/events/${eventId}/seats`}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          좌석 다시 선택
        </Link>
      </div>
    </div>
  );
}
