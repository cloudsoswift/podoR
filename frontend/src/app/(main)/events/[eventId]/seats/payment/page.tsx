"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createOrder, releaseHolds, errorDetail } from "@/lib/api/ticketing";

export default function PaymentPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const seatsParam = search.get("seats") ?? "";
  const seatSeqs = seatsParam.split(",").filter(Boolean).map(Number);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  // 언마운트 해제를 잠시 미뤄두는 타이머. StrictMode(개발)의 mount→cleanup→mount 재실행에서
  // cleanup 이 즉시 돌아 "방금 잡은 선점"이 해제되는 것을 막는다.
  // 실제 이탈이면 재마운트가 없으므로 타이머가 그대로 실행된다.
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 결제 완료 없이 이탈하면 선점 해제
  useEffect(() => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current); // 재마운트 → 예약된 해제 취소
      releaseTimer.current = null;
    }

    const release = () => {
      if (!done && seatSeqs.length > 0) releaseHolds(eventId, seatSeqs).catch(() => {});
    };
    window.addEventListener("beforeunload", release); // 브라우저 종료/새로고침은 즉시 해제

    return () => {
      window.removeEventListener("beforeunload", release);
      releaseTimer.current = setTimeout(release, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, done, seatsParam]);

  async function handlePay() {
    setPaying(true);
    try {
      const { orderNumber } = await createOrder(eventId, seatSeqs);
      setDone(true);
      router.replace(`/order/${orderNumber}/complete`);
    } catch (e) {
      alert(errorDetail(e, "결제에 실패했습니다. 선점이 만료되었을 수 있어요. 좌석을 다시 선택해주세요."));
      router.replace(`/events/${eventId}/seats`);
    }
  }

  if (seatSeqs.length === 0) {
    return <p className="p-8 text-sm text-gray-500">선택된 좌석이 없습니다.</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">결제</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <p className="text-gray-500">선택 좌석 {seatSeqs.length}석</p>
        <p className="mt-2 text-xs text-amber-600">선점은 5분간 유효합니다. 시간 내 결제해주세요.</p>
      </div>
      <button
        onClick={handlePay}
        disabled={paying}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {paying ? "결제 중…" : "결제하기 (Mock)"}
      </button>
    </div>
  );
}
