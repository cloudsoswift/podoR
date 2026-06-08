import { SeatEditorAction, SeatEditorState } from "./seatEditorReducer";
import { GridConfig, SeatTool } from "./seatTypes";

interface Props {
  state: SeatEditorState;
  dispatch: React.Dispatch<SeatEditorAction>;
  // 통합 화면에서 섹션 에디터로 돌아가는 핸들러. 없으면 뒤로가기 버튼을 숨긴다.
  onExit?: () => void;
}

const TOOLS: { tool: SeatTool; label: string }[] = [
  { tool: "pan", label: "손" },
  { tool: "select", label: "선택" },
];

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-600">
      {label}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-14 rounded-md border border-gray-300 px-1.5 py-1 text-sm"
      />
    </label>
  );
}

export default function SeatToolbar({ state, dispatch, onExit }: Props) {
  const g = state.grid;
  const hasSeats = state.seats.length > 0;
  const selCount = state.selectedIds.length;
  const setGrid = (patch: Partial<GridConfig>) =>
    dispatch({ type: "SET_GRID", patch });
  const setSelectedAvailable = (available: boolean) =>
    dispatch({ type: "SET_SEATS_AVAILABLE", ids: state.selectedIds, available });

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      {onExit && (
        <>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            title="섹션 에디터로 돌아갑니다(좌석은 유지됩니다)."
          >
            ← 섹션
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {state.section.name}
          </span>
          <div className="h-5 w-px bg-gray-200" />
        </>
      )}

      {/* 도구 */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
        {TOOLS.map(({ tool, label }) => (
          <button
            key={tool}
            type="button"
            onClick={() => dispatch({ type: "SET_TOOL", tool })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              state.tool === tool
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {/* 격자 채우기 파라미터 */}
      <div className="flex flex-wrap items-center gap-2">
        <NumberField
          label="가로 간격"
          value={g.colPitch}
          min={6}
          onChange={(v) => setGrid({ colPitch: v })}
        />
        <NumberField
          label="세로 간격"
          value={g.rowPitch}
          min={6}
          onChange={(v) => setGrid({ rowPitch: v })}
        />
        <button
          type="button"
          onClick={() => dispatch({ type: "GENERATE_GRID" })}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          title="현재 간격으로 섹션을 좌석으로 가득 채웁니다(기존 좌석은 대체)."
        >
          좌석 채우기
        </button>
        <button
          type="button"
          disabled={!hasSeats}
          onClick={() => dispatch({ type: "SET_ALL_AVAILABLE", available: true })}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40"
          title="모든 좌석을 '사용'으로 되돌립니다."
        >
          모두 사용
        </button>
        <button
          type="button"
          disabled={!hasSeats}
          onClick={() => dispatch({ type: "CLEAR_SEATS" })}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40"
        >
          비우기
        </button>
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {/* 선택 좌석 사용 여부 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{selCount}석 선택</span>
        <button
          type="button"
          disabled={selCount === 0}
          onClick={() => setSelectedAvailable(false)}
          className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
        >
          사용 안 함
        </button>
        <button
          type="button"
          disabled={selCount === 0}
          onClick={() => setSelectedAvailable(true)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
        >
          사용
        </button>
      </div>

      <span className="ml-auto text-xs text-gray-400">
        드래그=상자 선택 · 클릭=토글 · 선택 후 사용/사용 안 함 · 손=화면 이동 · 휠=확대/축소
      </span>
    </div>
  );
}
