"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPayment, errorDetail } from "@/lib/api/ticketing";
import { clearPaymentRedirect } from "@/lib/paymentRedirect";

/**
 * 토스 successUrl. 쿼리(paymentKey, orderId, amount)로 서버에 승인을 요청한다.
 * seats 레이아웃(대기열 게이트) 밖에 둔다 — 결제 중 입장권이 만료돼도 확정할 수 있어야 한다.
 */
export default function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const paymentKey = search.get("paymentKey") ?? "";
  const orderId = search.get("orderId") ?? "";
  const amount = Number(search.get("amount"));
  const invalid = !paymentKey || !orderId || !Number.isFinite(amount);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const error = invalid ? "결제 정보가 올바르지 않습니다." : confirmError;

  // 확정은 한 번만 — StrictMode 의 effect 재실행에서 두 번 승인 요청을 보내지 않는다.
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    clearPaymentRedirect(eventId);
    if (invalid) return;

    confirmPayment(eventId, orderId, { paymentKey, amount })
      .then(({ orderNumber }) => router.replace(`/order/${orderNumber}/complete`))
      .catch((e) => setConfirmError(errorDetail(e, "결제 승인에 실패했습니다. 좌석을 다시 선택해주세요.")));
  }, [eventId, paymentKey, orderId, amount, invalid, router]);

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">결제</h1>
      {error ? (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="text-red-600">{error}</p>
          <Link href={`/events/${eventId}/seats`} className="inline-block font-medium text-indigo-600 hover:text-indigo-700">
            좌석 다시 선택
          </Link>
        </div>
      ) : (
        <p className="text-sm text-gray-500">결제를 승인하는 중…</p>
      )}
    </div>
  );
}
