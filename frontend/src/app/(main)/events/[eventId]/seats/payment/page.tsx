"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ANONYMOUS, loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { confirmPayment, errorDetail, prepareOrder, PreparedOrder, releaseHolds } from "@/lib/api/ticketing";
import { clearPaymentRedirect, isPaymentRedirect, markPaymentRedirect } from "@/lib/paymentRedirect";

type Phase =
  | { kind: "preparing" }
  | { kind: "ready"; order: PreparedOrder }
  | { kind: "error"; message: string };

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
  // 키가 있으면 토스 결제위젯, 없으면(로컬 mock) 모의 결제 버튼. 서버의 payment.gateway 와 짝을 맞춰야 한다.
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  const [phase, setPhase] = useState<Phase>({ kind: "preparing" });
  const [widgetReady, setWidgetReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

  // 준비 → (키가 있으면) 위젯 렌더. StrictMode 의 effect 재실행에서 위젯을 두 번 그리면 SDK 가
  // AlreadyRenderedError 를 내므로 같은 회차·좌석에 대해 한 번만 실행한다.
  const initFor = useRef<string | null>(null);
  useEffect(() => {
    const initKey = `${eventId}|${seatsParam}`;
    if (seatsParam === "" || initFor.current === initKey) return;
    initFor.current = initKey;

    // 결제창에서 브라우저 뒤로가기 등으로 돌아온 경우 남아 있는 이동 표시를 지운다.
    clearPaymentRedirect(eventId);

    (async () => {
      let order: PreparedOrder;
      try {
        order = await prepareOrder(eventId, seatsParam.split(",").filter(Boolean).map(Number));
      } catch (e) {
        setPhase({
          kind: "error",
          message: errorDetail(e, "결제를 준비하지 못했습니다. 선점이 만료되었을 수 있어요. 좌석을 다시 선택해주세요."),
        });
        return;
      }
      setPhase({ kind: "ready", order });
      if (!clientKey) return;

      try {
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: "KRW", value: order.amount }); // 결제수단보다 먼저
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method" }),
          widgets.renderAgreement({ selector: "#agreement" }),
        ]);
        widgetsRef.current = widgets;
        setWidgetReady(true);
      } catch {
        setPhase({ kind: "error", message: "결제 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." });
      }
    })();
  }, [eventId, seatsParam, clientKey]);

  // 언마운트 해제를 잠시 미뤄두는 타이머. StrictMode(개발)의 mount→cleanup→mount 재실행에서
  // cleanup 이 즉시 돌아 "방금 잡은 선점"이 해제되는 것을 막는다.
  // 실제 이탈이면 재마운트가 없으므로 타이머가 그대로 실행된다.
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 결제 완료 없이 이탈하면 선점 해제. 단, 토스 결제창으로 이동 중이면 건너뛴다 —
  // 선점이 풀리면 돌아와서 확정할 수 없다(정리는 서버가 맡는다).
  useEffect(() => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current); // 재마운트 → 예약된 해제 취소
      releaseTimer.current = null;
    }

    const release = () => {
      if (done || seatSeqs.length === 0 || isPaymentRedirect(eventId)) return;
      releaseHolds(eventId, seatSeqs).catch(() => {});
    };
    window.addEventListener("beforeunload", release); // 브라우저 종료/새로고침은 즉시 해제

    return () => {
      window.removeEventListener("beforeunload", release);
      releaseTimer.current = setTimeout(release, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, done, seatsParam]);

  async function handleWidgetPay(order: PreparedOrder) {
    const widgets = widgetsRef.current;
    if (!widgets) return;
    setPaying(true);
    const origin = window.location.origin;
    markPaymentRedirect(eventId); // 이 뒤의 beforeunload·pagehide 에서 선점·입장권을 반납하지 않게
    try {
      await widgets.requestPayment({
        orderId: order.orderNumber,
        orderName: order.orderName,
        successUrl: `${origin}/events/${eventId}/payment/success`,
        failUrl: `${origin}/events/${eventId}/payment/fail?orderNumber=${order.orderNumber}&seats=${seatSeqs.join(",")}`,
      });
    } catch (e) {
      // 결제창을 띄우지 못함(파라미터 오류 등) — 페이지에 남으므로 이동 표시를 되돌린다.
      clearPaymentRedirect(eventId);
      setPaying(false);
      alert(e instanceof Error && e.message ? e.message : "결제창을 열지 못했습니다.");
    }
  }

  async function handleMockPay(order: PreparedOrder) {
    setPaying(true);
    try {
      const { orderNumber } = await confirmPayment(eventId, order.orderNumber, {
        paymentKey: `mock-${order.orderNumber}`,
        amount: order.amount,
      });
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

  const order = phase.kind === "ready" ? phase.order : null;

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">결제</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        {order && <p className="font-medium text-gray-900">{order.orderName}</p>}
        <p className="mt-1 text-gray-500">선택 좌석 {seatSeqs.length}석</p>
        {order && (
          <p className="mt-2 text-lg font-bold text-gray-900">{order.amount.toLocaleString("ko-KR")}원</p>
        )}
        <p className="mt-2 text-xs text-amber-600">선점은 15분간 유효합니다. 시간 내 결제해주세요.</p>
      </div>

      {phase.kind === "preparing" && <p className="text-sm text-gray-500">결제 준비 중…</p>}

      {phase.kind === "error" && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="text-red-600">{phase.message}</p>
          <Link href={`/events/${eventId}/seats`} className="inline-block font-medium text-indigo-600 hover:text-indigo-700">
            좌석 다시 선택
          </Link>
        </div>
      )}

      {/* 위젯이 그려질 자리 — 렌더 호출 시점에 DOM 에 있어야 하므로 준비 중에도 둔다. */}
      {clientKey && phase.kind !== "error" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div id="payment-method" />
          <div id="agreement" />
        </div>
      )}

      {order && clientKey && (
        <button
          onClick={() => handleWidgetPay(order)}
          disabled={!widgetReady || paying}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {paying ? "결제창으로 이동 중…" : "결제하기"}
        </button>
      )}

      {order && !clientKey && (
        <button
          onClick={() => handleMockPay(order)}
          disabled={paying}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {paying ? "결제 중…" : "모의 결제"}
        </button>
      )}
    </div>
  );
}
