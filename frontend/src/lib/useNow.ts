"use client";

import { useEffect, useState } from "react";

/**
 * tickMs 마다 갱신되는 현재 시각. 카운트다운을 여러 개 그릴 때 인터벌을 행마다 만들지 않도록
 * 목록(또는 작은 표시 컴포넌트) 단위로 한 번만 쓴다.
 */
export function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return now;
}
