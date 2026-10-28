"use client";

import Link from "next/link";
import { EventItem } from "@/lib/api/events";
import { formatCountdown } from "@/lib/countdown";
import { formatDateTime } from "@/lib/format";
import { loginHref } from "@/lib/redirect";
import { useNow } from "@/lib/useNow";
import { useAuthStore } from "@/store/authStore";

/**
 * 이벤트 상세의 회차 목록. 회차마다 ticketingDate 전에는 남은 시간을, 이후에는 예매하기 링크를 보여준다.
 *
 * - 1초 틱은 목록 전체에서 useNow 하나로 돌린다(행마다 인터벌을 만들지 않는다).
 * - 표시는 클라이언트 시계, 판정은 서버다. 시계가 빨라 일찍 들어가면 게이트가 NOT_OPEN 을 받고 재시도로 맞춘다.
 * - 좌석을 보는 것 자체가 대기열 진입이므로 라벨은 "예매하기". 비로그인이면 로그인 후 좌석으로 돌아오게 한다.
 */
export default function SessionList({ sessions }: { sessions: EventItem[] }) {
  const now = useNow();
  const loggedIn = useAuthStore((s) => Boolean(s.accessToken));

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-400">회차 정보가 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const untilOpen = new Date(s.ticketingDate).getTime() - now;
        const seatsPath = `/events/${s.eventId}/seats`;
        const date = <span className="text-sm font-medium text-gray-800">{formatDateTime(s.eventDate)}</span>;

        if (untilOpen > 0) {
          return (
            <div
              key={s.eventId}
              aria-disabled="true"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              {date}
              <span className="text-sm text-gray-400">예매 오픈까지 {formatCountdown(untilOpen)}</span>
            </div>
          );
        }

        return (
          <Link
            key={s.eventId}
            href={loggedIn ? seatsPath : loginHref(seatsPath)}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-indigo-300"
          >
            {date}
            <span className="text-sm text-indigo-600">예매하기 →</span>
          </Link>
        );
      })}
    </div>
  );
}
