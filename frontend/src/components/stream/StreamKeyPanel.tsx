"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { endStream, getStreamKey, reissueStreamKey, StreamKey, StreamStatus } from "@/lib/api/stream";

const POLL_MS = 5000;

const STATUS_LABEL: Record<StreamStatus, string> = {
  SCHEDULED: "송출 전",
  LIVE: "방송 중",
  INTERRUPTED: "끊김(3분 안에 다시 송출하면 이어집니다)",
  ENDED: "종료",
};

type Confirming = "reissue" | "end" | null;

/** host 의 OBS 설정값(서버 주소·스트림 키)과 방송 상태·종료. 상태는 5초마다 다시 받는다. */
export default function StreamKeyPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<StreamKey | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getStreamKey(eventId));
    } catch {
      setError("송출 정보를 불러오지 못했습니다.");
    }
  }, [eventId]);

  useEffect(() => {
    // 최초 로드와 상태 폴링
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.streamKey);
    setMessage("스트림 키를 복사했습니다.");
  };

  const reissue = async () => {
    setBusy(true);
    try {
      setData(await reissueStreamKey(eventId));
      setRevealed(false);
      setMessage("스트림 키를 재발급했습니다. OBS 설정도 바꿔 주세요.");
    } catch (e) {
      setMessage(
        axios.isAxiosError(e) && e.response?.status === 409
          ? "방송 중에는 재발급할 수 없습니다."
          : "재발급에 실패했습니다.",
      );
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const end = async () => {
    const wasLive = data?.status === "LIVE";
    setBusy(true);
    try {
      await endStream(eventId);
      setMessage(wasLive ? "OBS 에서 방송 중지를 누르면 VOD 를 만듭니다." : "방송을 종료했습니다. VOD 를 만드는 중입니다.");
      await load();
    } catch {
      setMessage("방송 종료에 실패했습니다.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">불러오는 중...</p>;

  const canEnd = data.status === "LIVE" || data.status === "INTERRUPTED";
  const button =
    "rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">방송 상태</h2>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
            {STATUS_LABEL[data.status]}
          </span>
        </div>
        {canEnd && (
          <button
            onClick={() => setConfirming("end")}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            방송 종료
          </button>
        )}
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">OBS 설정</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">서버</dt>
            <dd className="font-mono text-gray-800">{data.rtmpUrl}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">스트림 키</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-gray-800">{revealed ? data.streamKey : "••••••••••••"}</span>
              <button onClick={() => setRevealed((r) => !r)} className={button}>
                {revealed ? "숨기기" : "보기"}
              </button>
              <button onClick={copy} className={button}>
                복사
              </button>
              <button onClick={() => setConfirming("reissue")} disabled={busy} className={button}>
                재발급
              </button>
            </dd>
          </div>
        </dl>
        <ul className="list-disc pl-5 text-xs text-gray-500 space-y-1">
          <li>OBS 설정 → 방송 → 서비스 &quot;사용자 지정&quot;, 위 서버와 스트림 키를 입력합니다.</li>
          <li>출력 → 키프레임 간격은 2초로 맞춥니다.</li>
          <li>스트림 키는 다른 사람에게 보여 주지 마세요. 노출되면 재발급합니다.</li>
        </ul>
      </section>

      <ConfirmDialog
        open={confirming === "reissue"}
        title="스트림 키 재발급"
        description="지금 키는 더 이상 쓸 수 없게 됩니다. OBS 설정도 새 키로 바꿔야 합니다."
        confirmText="재발급하기"
        loading={busy}
        onConfirm={reissue}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "end"}
        title="방송 종료"
        description="종료하면 다시 송출할 수 없고, 녹화본(VOD)을 만듭니다."
        confirmText="종료하기"
        loading={busy}
        onConfirm={end}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
