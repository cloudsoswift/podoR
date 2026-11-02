"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { getStreamView, StreamView } from "@/lib/api/stream";

const POLL_MS = 5000;

/**
 * 관람 상태를 5초마다 다시 받는다. 매 응답이 관람 쿠키(10분)도 새로 굽기 때문에
 * 오래 시청해도 HLS 조각 요청이 끊기지 않는다. 403(예매자 아님)이면 폴링을 멈춘다.
 */
export function useStreamView(eventId: string) {
  const [view, setView] = useState<StreamView | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    // catch 는 첫 await 이후에 돌므로 그때는 아래 timer 가 이미 할당돼 있다.
    async function load() {
      try {
        const data = await getStreamView(eventId);
        if (!active) return;
        setView(data);
        setError(false);
      } catch (e) {
        if (!active) return;
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          setForbidden(true);
          clearInterval(timer);
        } else {
          setError(true);
        }
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [eventId]);

  return { view, forbidden, error };
}
