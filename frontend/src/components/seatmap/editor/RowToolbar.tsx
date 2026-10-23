import { useState } from "react";
import { RowEditorMode } from "@/components/seatmap/core/seatTypes";
import { RowEditorAction, RowEditorState } from "./rowEditorReducer";

interface Props {
  state: RowEditorState;
  dispatch: React.Dispatch<RowEditorAction>;
  // 새 줄을 놓을 자리(현재 화면 중앙)에 좌석 수 n 줄을 추가한다.
  onAddRow: (seatCount: number) => void;
  // 통합 화면에서 섹션 에디터로 돌아가는 핸들러. 없으면 버튼을 숨긴다.
  onExit?: () => void;
}

const MODES: { mode: RowEditorMode; label: string }[] = [
  { mode: "row", label: "줄" },
  { mode: "seat", label: "좌석" },
];

const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40";

export default function RowToolbar({ state, dispatch, onAddRow, onExit }: Props) {
  // 입력 중 빈칸을 허용하려고 문자열로 들고 있는다.
  const [count, setCount] = useState("10");
  const selCount = state.selectedSeatKeys.length;
  const setSelectedAvailable = (available: boolean) =>
    dispatch({ type: "SET_SEATS_AVAILABLE", keys: state.selectedSeatKeys, available });

  function addRow() {
    const n = Math.floor(Number(count));
    if (Number.isFinite(n) && n >= 1) onAddRow(n);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      {onExit && (
        <>
          <button
            type="button"
            onClick={onExit}
            className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}
            title="섹션 에디터로 돌아갑니다(줄은 유지됩니다)."
          >
            ← 섹션
          </button>
          <span className="text-sm font-semibold text-gray-700">{state.section.name}</span>
          <div className="h-5 w-px bg-gray-200" />
        </>
      )}

      {/* 모드 */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={state.mode === mode}
            onClick={() => dispatch({ type: "SET_MODE", mode })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              state.mode === mode ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {state.mode === "row" ? (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            새 줄 좌석 수
            <input
              type="number"
              min={1}
              aria-label="새 줄 좌석 수"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRow()}
              className="w-16 rounded-md border border-gray-300 px-1.5 py-1 text-sm"
            />
          </label>
          <button type="button" onClick={addRow} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
            줄 추가
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{selCount}석 선택</span>
          <button
            type="button"
            disabled={selCount === 0}
            onClick={() => setSelectedAvailable(false)}
            className={`${btn} bg-red-50 text-red-600 hover:bg-red-100`}
          >
            사용 안 함
          </button>
          <button
            type="button"
            disabled={selCount === 0}
            onClick={() => setSelectedAvailable(true)}
            className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          >
            사용
          </button>
        </div>
      )}

      <span className="ml-auto text-xs text-gray-400">
        {state.mode === "row"
          ? "클릭=선택 · Shift=추가 선택 · 드래그=이동/상자 선택 · Ctrl+드래그·Ctrl+D=복제 · Delete=삭제"
          : "클릭=사용 여부 토글 · 드래그=상자 선택 · Delete=사용 안 함"}
        {" · 가운데 버튼=화면 이동 · 휠=확대/축소"}
      </span>
    </div>
  );
}
