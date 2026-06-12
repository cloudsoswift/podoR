"use client";

import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import { buildSeatmapPayload, registerSeatmap } from "./seatmapApi";

interface Props {
  sections: Section[];
  seatsBySection: Record<string, Seat[]>;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * 섹션 배치 + 좌석을 하나의 JSON 으로 합쳐 백엔드에 등록하는 상단 바.
 * venue seq 를 입력하고 '백엔드 등록'을 누르면 POST /venues/{venueSeq}/seatmap 으로 전송한다.
 */
export default function SeatmapRegisterBar({ sections, seatsBySection }: Props) {
  const [venueSeq, setVenueSeq] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showJson, setShowJson] = useState(false);

  const payload = useMemo(
    () => buildSeatmapPayload(sections, seatsBySection),
    [sections, seatsBySection],
  );
  const combinedJson = useMemo(
    () => JSON.stringify(payload, null, 2),
    [payload],
  );

  const seqNum = Number(venueSeq);
  const seqValid = venueSeq.trim() !== "" && Number.isInteger(seqNum) && seqNum > 0;
  const canSubmit = seqValid && status.kind !== "loading";

  async function handleRegister() {
    if (!seqValid) {
      setStatus({ kind: "error", message: "유효한 venue seq 를 입력하세요." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await registerSeatmap(seqNum, payload);
      setStatus({
        kind: "success",
        message: `등록 완료 — 섹션 ${sections.length}개 · 좌석 ${result.seatCount}석`,
      });
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      const detail =
        ax.response?.status != null
          ? `(${ax.response.status}) ${ax.response.data?.message ?? ax.message}`
          : ax.message;
      setStatus({ kind: "error", message: `등록 실패 — ${detail}` });
    }
  }

  function handleCopyJson() {
    navigator.clipboard?.writeText(combinedJson);
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-700">좌석맵 등록</span>
        <span className="text-xs text-gray-400">
          섹션 {sections.length}개 · 좌석 {payload.seats.length}석
        </span>

        <div className="h-5 w-px bg-gray-200" />

        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          venue seq
          <input
            type="number"
            min={1}
            value={venueSeq}
            onChange={(e) => setVenueSeq(e.target.value)}
            placeholder="예: 1"
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleRegister}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {status.kind === "loading" ? "등록 중…" : "백엔드 등록"}
        </button>

        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
        >
          {showJson ? "JSON 닫기" : "합친 JSON 보기"}
        </button>

        {status.kind === "success" && (
          <span className="text-xs font-medium text-emerald-600">
            {status.message}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-xs font-medium text-red-600">
            {status.message}
          </span>
        )}
      </div>

      {showJson && (
        <div className="border-t border-gray-100 px-4 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              POST /venues/{seqValid ? seqNum : "{venueSeq}"}/seatmap 요청 본문
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              복사
            </button>
          </div>
          <textarea
            value={combinedJson}
            readOnly
            spellCheck={false}
            className="h-40 w-full resize-none rounded-md border border-gray-300 bg-gray-50 p-2 font-mono text-xs text-gray-700"
          />
        </div>
      )}
    </div>
  );
}
