"use client";

import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import {
  buildSeatmapPayload,
  findDuplicateSectionNames,
  registerSeatmap,
} from "./seatmapApi";

interface Props {
  venueSeq: number;
  sections: Section[];
  seatsBySection: Record<string, Seat[]>;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * 섹션 배치 + 좌석을 하나의 JSON 으로 합쳐 백엔드에 저장(upsert)하는 상단 바.
 * venue 는 URL 로 특정되므로 prop 으로 받는다. POST /venues/{venueSeq}/seatmap.
 */
export default function SeatmapRegisterBar({ venueSeq, sections, seatsBySection }: Props) {
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

  const duplicateNames = useMemo(
    () => findDuplicateSectionNames(sections),
    [sections],
  );
  const hasDuplicateNames = duplicateNames.length > 0;

  const canSubmit = status.kind !== "loading" && !hasDuplicateNames;

  async function handleRegister() {
    if (hasDuplicateNames) {
      setStatus({
        kind: "error",
        message: `저장 실패 — 섹션 이름이 중복되었습니다: ${duplicateNames.join(", ")}. 이름을 다르게 지정하세요.`,
      });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await registerSeatmap(venueSeq, payload);
      setStatus({
        kind: "success",
        message: `저장 완료 — 섹션 ${sections.length}개 · 좌석 ${result.seatCount}석`,
      });
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      const detail =
        ax.response?.status != null
          ? `(${ax.response.status}) ${ax.response.data?.message ?? ax.message}`
          : ax.message;
      setStatus({ kind: "error", message: `저장 실패 — ${detail}` });
    }
  }

  function handleCopyJson() {
    navigator.clipboard?.writeText(combinedJson);
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-700">좌석맵 저장</span>
        <span className="text-xs text-gray-400">
          섹션 {sections.length}개 · 좌석 {payload.seats.length}석
        </span>

        <div className="h-5 w-px bg-gray-200" />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleRegister}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {status.kind === "loading" ? "저장 중…" : "저장"}
        </button>

        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
        >
          {showJson ? "JSON 닫기" : "합친 JSON 보기"}
        </button>

        {hasDuplicateNames && (
          <span className="text-xs font-medium text-amber-600">
            섹션 이름 중복: {duplicateNames.join(", ")} — 이름을 다르게 지정하세요.
          </span>
        )}
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
              POST /venues/{venueSeq}/seatmap 요청 본문
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
