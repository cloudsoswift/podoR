"use client";

import { formatCountdown } from "@/lib/countdown";
import { useNow } from "@/lib/useNow";

/*
 * 시계(1초 틱)를 가진 작은 컴포넌트들.
 * 게이트가 직접 useNow 를 쓰면 입장 후 children(좌석맵 전체)까지 매초 다시 그리게 되므로 분리한다.
 */

export function Countdown({ to }: { to: string }) {
  const now = useNow();
  return <>{formatCountdown(new Date(to).getTime() - now)}</>;
}

/** 입장권은 고정 시간이다. 표시가 없으면 만료 시 이유도 모른 채 대기실로 돌아가게 된다. */
export function PassTimer({ expiresAt }: { expiresAt: string }) {
  const now = useNow();
  // fixed 가 아니라 페이지 흐름 안에 둔다 — sticky 헤더 뒤로 가려지는 문제를 피한다.
  return (
    <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
      입장 시간 {formatCountdown(new Date(expiresAt).getTime() - now)} 남음
    </p>
  );
}
