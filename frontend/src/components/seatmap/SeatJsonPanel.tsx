import { useState } from "react";
import { isValidSections } from "./geometry";
import { rowLabel } from "./seatGeometry";
import { SeatEditorAction, SeatEditorState } from "./seatEditorReducer";

interface Props {
  state: SeatEditorState;
  dispatch: React.Dispatch<SeatEditorAction>;
}

/**
 * 저장용 좌석 목록(사용 좌석만).
 * - 행: 사용 좌석이 있는 행만 위→아래로 모아 A,B,C… 재부여(빈 앞행/중간행으로 인한 결번 없음).
 * - 열 번호: 생성 시 번호 유지(미사용 좌석으로 인한 결번은 그대로 둠).
 */
function exportSeats(state: SeatEditorState) {
  const used = state.seats.filter((s) => s.available);
  const rowsPresent = [...new Set(used.map((s) => s.gridRow))].sort(
    (a, b) => a - b,
  );
  const labelByRow = new Map(rowsPresent.map((gr, i) => [gr, rowLabel(i)]));
  return used
    .slice()
    .sort((a, b) => a.gridRow - b.gridRow || a.number - b.number)
    .map((s) => ({
      section: state.section.name,
      row: labelByRow.get(s.gridRow),
      number: s.number,
    }));
}

export default function SeatJsonPanel({ state, dispatch }: Props) {
  const rows = exportSeats(state);
  const exported = JSON.stringify(rows, null, 2);
  const [boundary, setBoundary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = state.seats.length;
  const used = rows.length;
  const rowCount = new Set(rows.map((r) => r.row)).size;

  function handleCopy() {
    navigator.clipboard?.writeText(exported);
  }

  function handleDownload() {
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seats.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // SectionEditor 에서 내보낸 Section[] JSON 의 첫 섹션을 경계로 불러온다.
  function handleLoadBoundary() {
    try {
      const parsed = JSON.parse(boundary);
      if (!isValidSections(parsed) || parsed.length === 0) {
        setError("Section[] 형식이 아니거나 비어 있습니다.");
        return;
      }
      dispatch({ type: "SET_SECTION", section: parsed[0] });
      setError(null);
    } catch {
      setError("JSON 파싱에 실패했습니다.");
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">
          저장 좌석 {used}개{" "}
          <span className="font-normal text-gray-400">
            ({rowCount}개 행 · 전체 {total})
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-gray-400">경계: {state.section.name}</p>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          복사
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          다운로드
        </button>
      </div>

      <textarea
        value={exported}
        readOnly
        spellCheck={false}
        className="min-h-0 flex-1 resize-none rounded-md border border-gray-300 bg-gray-50 p-2 font-mono text-xs text-gray-700"
      />

      <div className="border-t border-gray-200 pt-3">
        <h3 className="mb-1 text-xs font-semibold text-gray-600">
          경계 불러오기 (Section[] JSON)
        </h3>
        <textarea
          value={boundary}
          onChange={(e) => setBoundary(e.target.value)}
          spellCheck={false}
          placeholder='[{"id":"...","name":"...","color":"#...","anchors":[...]}]'
          className="h-20 w-full resize-none rounded-md border border-gray-300 p-2 font-mono text-xs text-gray-700"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleLoadBoundary}
          className="mt-1.5 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          경계로 설정 (좌석 초기화)
        </button>
      </div>
    </div>
  );
}
