"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { getStreamView, StreamView } from "@/lib/api/stream";

const DEFAULT_MS = 5000;
const INTERRUPTED_MS = 2000; // 재송출하면 시청 화면이 빨리 돌아오도록
const VOD_READY_MS = 60000; // 더 바뀔 상태는 없고 관람 쿠키(10분) 연장만 필요하다

/**
 * 다음 폴링까지의 지연(ms). null 이면 더 부르지 않는다.
 * view 가 없으면(요청 실패 등) 상태를 모르니 기본 주기로 다시 시도한다.
 */
export function nextPollDelay(view: StreamView | null): number | null {
  if (!view) return DEFAULT_MS;
  if (view.status === "INTERRUPTED") return INTERRUPTED_MS;
  if (view.status === "ENDED" && view.vodStatus === "READY") return VOD_READY_MS;
  if (view.status === "ENDED" && view.vodStatus === "FAILED") return null;
  return DEFAULT_MS;
}

/**
 * 관람 상태를 다시 받는다. 매 응답이 관람 쿠키(10분)도 새로 굽기 때문에 오래 시청해도
 * HLS 조각 요청이 끊기지 않는다. 주기는 응답 상태로 정하고(nextPollDelay),
 * 403(예매자 아님)이면 폴링을 멈춘다.
 */
export function useStreamView(eventId: string) {
  const [view, setView] = useState<StreamView | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule(delay: number | null) {
      if (active && delay !== null) timer = setTimeout(load, delay);
    }

    async function load() {
      try {
        const data = await getStreamView(eventId);
        if (!active) return;
        setView(data);
        setError(false);
        schedule(nextPollDelay(data));
      } catch (e) {
        if (!active) return;
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setForbidden(true);
        } else {
          setError(true);
          schedule(nextPollDelay(null));
        }
      }
    }

    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [eventId]);

  return { view, forbidden, error };
}
