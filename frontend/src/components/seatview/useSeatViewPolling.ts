"use client";

import { useEffect, useRef, useState } from "react";
import { getSeatView, getSeatViewChanges, SeatViewSeat } from "@/lib/api/seatview";

/**
 * seat-view 스냅샷 1회 로드 후 /changes 를 주기 폴링해 좌석 상태를 머지한다.
 * section 지정 시 해당 섹션 증분만(SeatMap Viewer), 미지정 시 이벤트 전체(Section Viewer).
 */
export function useSeatViewPolling(eventId: string, section?: string, intervalMs = 2500) {
  const [seats, setSeats] = useState<Map<number, SeatViewSeat>>(new Map());
  const [layoutJson, setLayoutJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const ch = await getSeatViewChanges(eventId, cursorRef.current, section);
        if (!alive) return;
        if (ch.seats.length > 0) {
          setSeats((prev) => {
            const next = new Map(prev);
            for (const s of ch.seats) next.set(s.eventSeatSeq, s);
            return next;
          });
        }
        cursorRef.current = ch.cursor;
      } catch {
        // 429/일시 오류는 다음 주기에 재시도
      } finally {
        if (alive) timer = setTimeout(poll, intervalMs);
      }
    }

    (async () => {
      setLoading(true);
      try {
        const snap = await getSeatView(eventId);
        if (!alive) return;
        setLayoutJson(snap.layoutJson);
        setSeats(new Map(snap.seats.map((s) => [s.eventSeatSeq, s])));
        cursorRef.current = snap.cursor;
      } finally {
        if (alive) {
          setLoading(false);
          timer = setTimeout(poll, intervalMs);
        }
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [eventId, section, intervalMs]);

  return { seats: [...seats.values()], layoutJson, loading };
}
