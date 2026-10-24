"use client";

import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import { Section } from "@/components/seatmap/core/types";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { validateLayout } from "@/components/seatmap/core/layoutValidation";
import {
  buildSeatmapPayload,
  cancelPreviewOf,
  findDuplicateSectionNames,
  registerSeatmap,
  SeatmapCancelPreview,
} from "@/components/seatmap/core/seatmapApi";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { formatDateTime } from "@/lib/format";

interface Props {
  venueSeq: number;
  sections: Section[];
  rowsBySection: Record<string, SeatRow[]>;
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
export default function SeatmapRegisterBar({
  venueSeq,
  sections,
  rowsBySection,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showJson, setShowJson] = useState(false);
  // 저장하면 예매가 취소되는 경우, 서버가 돌려준 미리보기(확인 창).
  const [cancelPreview, setCancelPreview] = useState<SeatmapCancelPreview | null>(null);

  const payload = useMemo(
    () => buildSeatmapPayload(sections, rowsBySection),
    [sections, rowsBySection],
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

  // 이름 없는 줄·번호 중복·좌석 겹침·섹션 밖 좌석·섹션 겹침이 있으면 저장하지 않는다.
  const problems = useMemo(() => validateLayout(sections, rowsBySection), [sections, rowsBySection]);

  const canSubmit = status.kind !== "loading" && !hasDuplicateNames && problems.length === 0;

  async function handleRegister() {
    if (problems.length > 0) return;
    if (hasDuplicateNames) {
      setStatus({
        kind: "error",
        message: `저장 실패 — 섹션 이름이 중복되었습니다: ${duplicateNames.join(", ")}. 이름을 다르게 지정하세요.`,
      });
      return;
    }
    await submit();
  }

  // confirmedCancelSeatCount: 확인 창에서 관리자가 본 취소 좌석 수. 서버 계산과 다르면 다시 409.
  async function submit(confirmedCancelSeatCount?: number) {
    setStatus({ kind: "loading" });
    try {
      const result = await registerSeatmap(
        venueSeq,
        confirmedCancelSeatCount === undefined ? payload : { ...payload, confirmedCancelSeatCount },
      );
      setCancelPreview(null);
      setStatus({
        kind: "success",
        message: `저장 완료 — 섹션 ${sections.length}개 · 좌석 ${result.seatCount}석`,
      });
    } catch (err) {
      const preview = cancelPreviewOf(err);
      if (preview) {
        setCancelPreview(preview);
        setStatus({ kind: "idle" });
        return;
      }
      setCancelPreview(null);
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

      {problems.length > 0 && (
        <ul className="border-t border-gray-100 px-4 py-2 text-xs text-red-600">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={cancelPreview !== null}
        title="예매가 취소됩니다"
        description={cancelPreview ? cancelDescription(cancelPreview) : undefined}
        confirmText="예매 취소하고 저장"
        cancelText="돌아가기"
        loading={status.kind === "loading"}
        onConfirm={() => cancelPreview && submit(cancelPreview.cancelSeatCount)}
        onCancel={() => setCancelPreview(null)}
      />

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

function cancelDescription(p: SeatmapCancelPreview): string {
  const events = p.events.map((e) => `${e.title} (${formatDateTime(e.eventDate)}) ${e.seatCount}석`).join(", ");
  return `이 저장으로 사라지거나 사용 안 함이 된 좌석의 예매, 주문 ${p.cancelOrderCount}건(${p.cancelSeatCount}석)이 취소됩니다. 대상 회차: ${events}`;
}
