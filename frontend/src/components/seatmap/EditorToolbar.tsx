import { EditorAction, EditorState } from "./editorReducer";
import { Section } from "./types";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export default function EditorToolbar({ state, dispatch }: Props) {
  const selected: Section | undefined = state.sections.find(
    (s) => s.id === state.selectedId,
  );

  const modeBtn = (mode: "draw" | "select", label: string) => (
    <button
      type="button"
      onClick={() => dispatch({ type: "SET_MODE", mode })}
      className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
        state.mode === mode
          ? "bg-indigo-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 bg-white">
      <div className="flex items-center gap-1.5">
        {modeBtn("draw", "그리기")}
        {modeBtn("select", "편집")}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {state.mode === "draw" ? (
        <span className="text-xs text-gray-500">
          캔버스를 클릭해 점을 찍고, 첫 점을 다시 클릭하면 도형이 됩니다 (최소 3점).
        </span>
      ) : selected ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={selected.name}
            onChange={(e) =>
              dispatch({
                type: "RENAME_SECTION",
                id: selected.id,
                name: e.target.value,
              })
            }
            className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="color"
            value={selected.color}
            onChange={(e) =>
              dispatch({
                type: "SET_COLOR",
                id: selected.id,
                color: e.target.value,
              })
            }
            className="h-7 w-9 cursor-pointer rounded border border-gray-300 p-0.5"
            aria-label="섹션 색상"
          />
          <button
            type="button"
            onClick={() => dispatch({ type: "DELETE_SECTION", id: selected.id })}
            className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            섹션 삭제
          </button>
          <span className="text-xs text-gray-400">
            앵커 드래그=이동 · Alt+드래그=곡선화 · 핸들 더블클릭=직선화
          </span>
        </div>
      ) : (
        <span className="text-xs text-gray-500">
          섹션을 클릭해 선택하면 앵커와 곡선을 편집할 수 있습니다.
        </span>
      )}

      <div className="ml-auto">
        <button
          type="button"
          onClick={() => dispatch({ type: "RESET" })}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
        >
          전체 초기화
        </button>
      </div>
    </div>
  );
}
