"use client";

import { useEffect, useState } from "react";

export default function MSWProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 명시적으로 NEXT_PUBLIC_API_MOCKING=enabled 일 때만 MSW 가동.
    // (예: `npm run dev:mock`) 기본은 꺼짐 → 실제 백엔드와 통신.
    if (process.env.NEXT_PUBLIC_API_MOCKING !== "enabled") {
      setReady(true);
      return;
    }

    import("./browser").then(({ worker }) => {
      worker.start({ onUnhandledRequest: "bypass" }).then(() => setReady(true));
    });
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
