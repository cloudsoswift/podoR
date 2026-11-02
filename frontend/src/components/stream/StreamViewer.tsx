"use client";

import { useEffect, useRef, useState } from "react";
import { useStreamView } from "./useStreamView";

function Notice({ children }: { children: string }) {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-gray-900 text-sm text-gray-200">
      {children}
    </div>
  );
}

const RETRY_MS = 2000;

/**
 * 라이브 재생. hls.js 가 되면 hls.js 로(화질 자동 전환), 아니면 Safari 의 네이티브 HLS 로.
 * 세션이 바뀌면(OBS 재접속) liveUrl 이 바뀌므로 이전 인스턴스를 정리하고 새 주소로 다시 붙는다.
 * 송출 직후에는 ffmpeg 가 아직 master.m3u8 을 쓰기 전이라 404 가 나는데, hls.js 는 4xx 를 다시
 * 시도하지 않으므로 치명적 오류가 나면 잠시 뒤 인스턴스를 새로 만든다.
 */
function LivePlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (Hls.isSupported()) {
        const instance = new Hls();
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || destroyed) return;
          instance.destroy();
          hls = null;
          retryTimer = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
        });
        instance.loadSource(url);
        instance.attachMedia(video);
        hls = instance;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      }
    });

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      hls?.destroy();
    };
  }, [url, attempt]);

  return (
    <video
      ref={videoRef}
      data-testid="live-video"
      controls
      autoPlay
      muted
      playsInline
      className="aspect-video w-full rounded-xl bg-black"
    />
  );
}

export default function StreamViewer({ eventId }: { eventId: string }) {
  const { view, forbidden, error } = useStreamView(eventId);

  if (forbidden) return <Notice>예매한 관객만 볼 수 있습니다.</Notice>;
  if (!view) return <Notice>{error ? "방송 정보를 불러오지 못했습니다." : "불러오는 중..."}</Notice>;

  switch (view.status) {
    case "SCHEDULED":
      return <Notice>방송 준비중입니다.</Notice>;
    case "INTERRUPTED":
      return <Notice>방송이 잠시 중단되었습니다.</Notice>;
    case "LIVE":
      return view.liveUrl ? <LivePlayer url={view.liveUrl} /> : <Notice>방송 준비중입니다.</Notice>;
    case "ENDED":
      if (view.vodStatus === "READY" && view.vodUrl) {
        return (
          <video
            data-testid="vod-video"
            src={view.vodUrl}
            controls
            playsInline
            className="aspect-video w-full rounded-xl bg-black"
          />
        );
      }
      if (view.vodStatus === "FAILED") return <Notice>VOD 를 준비하지 못했습니다.</Notice>;
      return <Notice>VOD 준비중입니다.</Notice>;
  }
}
