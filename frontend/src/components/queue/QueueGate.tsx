"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { enterQueue, leaveQueue, leaveQueueKeepalive, QueueStatus, QueueStatusResponse } from "@/lib/api/queue";
import { QUEUE_PASS_LOST_EVENT, QueuePassLostDetail } from "@/lib/queuePassLost";
import { formatDateTime } from "@/lib/format";
import { Countdown, PassTimer } from "./QueueTimers";

// setTimeout 은 2^31-1 ms(약 24.8일)를 넘기면 즉시 실행된다. 오픈이 한 달 뒤인 회차에서
// 요청이 무한 반복되지 않도록 상한을 둔다(상한에 닿으면 한 번 다시 확인할 뿐이다).
const MAX_TIMEOUT_MS = 2_147_483_647;

type GateState =
  | { kind: "checking" }
  | { kind: "error" }
  | { kind: "ready"; res: QueueStatusResponse };

interface Props {
  eventId: string;
  children: ReactNode;
  /** 대기 중 폴링 간격(= 하트비트). BE waiter-timeout(15초)보다 충분히 짧아야 한다. */
  pollMs?: number;
  /** 오픈 시각이 지났는데 서버가 아직 NOT_OPEN 일 때(시계 오차) 재시도 간격 */
  retryMs?: number;
  /** 언마운트 후 반납까지의 지연. StrictMode 재마운트가 이 안에 예약을 취소한다. */
  releaseDelayMs?: number;
}

/**
 * 좌석 플로우(좌석 선택·결제)의 입장 게이트. seats/layout.tsx 에 한 번만 둔다.
 * 레이아웃은 자식 라우트끼리 이동할 때 언마운트되지 않으므로, 좌석 ↔ 결제 이동에도 입장 상태가 유지된다.
 */
export default function QueueGate({ eventId, children, pollMs = 2500, retryMs = 1000, releaseDelayMs = 100 }: Props) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ kind: "checking" });
  // 증가시키면 입장 요청을 다시 보낸다(입장 요청 effect 의 의존성).
  const [attempt, setAttempt] = useState(0);
  const lastStatus = useRef<QueueStatus | null>(null);

  /** 화면은 그대로 두고 서버에 다시 확인한다 — 오픈 시각 도달 시. */
  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  /** children 을 즉시 내리고 처음부터 다시 줄을 선다 — 입장권 만료·상실 시. */
  const requeue = useCallback(() => {
    lastStatus.current = null;
    setState({ kind: "checking" });
    setAttempt((n) => n + 1);
  }, []);

  // 입장 요청. WAITING 이면 pollMs 마다 반복한다(setTimeout 체인이라 요청이 겹치지 않는다).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await enterQueue(eventId);
        if (!alive) return;
        lastStatus.current = res.status;
        setState({ kind: "ready", res });
        if (res.status === "WAITING") timer = setTimeout(poll, pollMs);
      } catch (e) {
        if (!alive) return;
        // 대기 중 일시 오류는 다음 주기에 재시도한다.
        // (15초 넘게 끊기면 BE 가 대기자를 정리하는데, 이는 BE 설계의 의도된 동작이다.)
        if (lastStatus.current === "WAITING") {
          timer = setTimeout(poll, pollMs);
          return;
        }
        // 401 은 axios 인터셉터가 refresh 하고, 실패하면 로그인 페이지로 보낸다.
        // 이동 직전에 오류 화면이 번쩍이지 않도록 '확인 중'에 머문다.
        if (isAxiosError(e) && e.response?.status === 401) return;
        setState({ kind: "error" });
      }
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [eventId, attempt, pollMs]);

  // 시각 기반 전환: 오픈 시각 도달 → 재확인 / 입장권 만료 → 재입장.
  useEffect(() => {
    if (state.kind !== "ready") return;
    const { res } = state;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (res.status === "NOT_OPEN") {
      const untilOpen = new Date(res.opensAt).getTime() - Date.now();
      // 이미 지났는데도 NOT_OPEN 이면 클라이언트 시계가 빠른 것 → retryMs 간격으로 서버에 맞춘다.
      timer = setTimeout(recheck, untilOpen > 0 ? Math.min(untilOpen, MAX_TIMEOUT_MS) : retryMs);
    } else if (res.status === "ADMITTED" && res.passExpiresAt) {
      const untilExpiry = new Date(res.passExpiresAt).getTime() - Date.now();
      timer = setTimeout(requeue, Math.min(Math.max(0, untilExpiry), MAX_TIMEOUT_MS));
    }

    return () => clearTimeout(timer);
  }, [state, recheck, requeue, retryMs]);

  // 입장권 상실(게이트 대상 API 의 403) — axios 인터셉터가 알린다. 다른 회차의 알림은 무시한다.
  useEffect(() => {
    const onPassLost = (e: Event) => {
      if ((e as CustomEvent<QueuePassLostDetail>).detail?.eventId === eventId) requeue();
    };
    window.addEventListener(QUEUE_PASS_LOST_EVENT, onPassLost);
    return () => window.removeEventListener(QUEUE_PASS_LOST_EVENT, onPassLost);
  }, [eventId, requeue]);

  // 떠날 때 반납한다.
  // - 앱 안에서 떠남(레이아웃 언마운트): releaseDelayMs 뒤 반납. StrictMode(개발)는 mount → cleanup → mount 로
  //   effect 를 다시 실행하는데, 재실행이 같은 회차의 예약을 취소하므로 마운트 직후 반납되지 않는다.
  //   (결제 페이지의 선점 해제와 같은 패턴)
  // - 탭 닫기·새로고침(pagehide): 둘을 구분할 수 없으므로 둘 다 반납한다 — 새로고침하면 순번이 뒤로 밀린다(확정 정책).
  const pendingRelease = useRef<{ eventId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => {
    // 같은 회차의 반납 예약만 취소한다. 다른 회차로 바뀐 경우엔 이전 회차를 그대로 반납해야 한다.
    if (pendingRelease.current?.eventId === eventId) {
      clearTimeout(pendingRelease.current.timer);
      pendingRelease.current = null;
    }

    const onPageHide = () => leaveQueueKeepalive(eventId);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      pendingRelease.current = {
        eventId,
        timer: setTimeout(() => {
          leaveQueue(eventId).catch(() => {});
        }, releaseDelayMs),
      };
    };
  }, [eventId, releaseDelayMs]);

  if (state.kind === "ready" && state.res.status === "ADMITTED") {
    return (
      <>
        {state.res.passExpiresAt && <PassTimer expiresAt={state.res.passExpiresAt} />}
        {children}
      </>
    );
  }

  return (
    <GateFrame onBack={() => router.push(`/events/${eventId}`)}>
      {state.kind === "checking" && <p className="text-sm text-gray-500">입장 확인 중…</p>}

      {state.kind === "error" && (
        <p className="text-sm text-red-600">대기열 정보를 불러오지 못했습니다.</p>
      )}

      {state.kind === "ready" && state.res.status === "NOT_OPEN" && (
        <>
          <p className="text-sm text-gray-500">예매 오픈까지</p>
          <p className="text-3xl font-bold text-gray-900">
            <Countdown to={state.res.opensAt} />
          </p>
          <p className="text-xs text-gray-400">{formatDateTime(state.res.opensAt)} 오픈</p>
        </>
      )}

      {state.kind === "ready" && state.res.status === "WAITING" && (
        <>
          <p className="text-lg font-semibold text-gray-900">입장 대기 중</p>
          <p className="text-sm text-gray-600">
            내 대기 순번 <strong className="text-2xl text-indigo-600">{state.res.position}번</strong>
          </p>
          <p className="text-sm text-gray-500">내 앞에 {state.res.ahead}명</p>
          <p className="pt-4 text-xs text-amber-600">새로고침하거나 창을 닫으면 순번이 뒤로 밀립니다.</p>
        </>
      )}
    </GateFrame>
  );
}

function GateFrame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <button type="button" onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900">
        ← 뒤로
      </button>
      <div className="mt-8 space-y-3 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        {children}
      </div>
    </div>
  );
}
