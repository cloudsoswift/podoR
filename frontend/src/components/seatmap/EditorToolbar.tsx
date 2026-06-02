import { EditorAction, EditorState } from "./editorReducer";
import { Section, Tool } from "./types";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const TOOLS: { tool: Tool; label: string; hint: string }[] = [
  {
    tool: "pan",
    label: "손",
    hint: "드래그해서 화면을 이동합니다. (휠로 확대/축소)",
  },
  {
    tool: "select",
    label: "선택",
    hint: "섹션을 클릭해 선택하고, 바디를 드래그하면 섹션 전체가 이동합니다.",
  },
  {
    tool: "pen",
    label: "펜",
    hint: "빈 곳을 클릭해 점을 찍고 첫 점을 다시 클릭하면 닫힙니다(최소 3점). 섹션을 클릭하면 앵커를 편집합니다.",
  },
];

export default function EditorToolbar({ state, dispatch }: Props) {
  const selected: Section | undefined = state.sections.find(
    (s) => s.id === state.selectedId,
  );
  const activeHint = TOOLS.find((t) => t.tool === state.tool)?.hint;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 bg-white">
      {/* 도구 선택 */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
        {TOOLS.map(({ tool, label }) => (
          <button
            key={tool}
            type="button"
            onClick={() => dispatch({ type: "SET_TOOL", tool })}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
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

      {/* 선택된 섹션 컨텍스트 컨트롤 (선택/펜 도구에서 노출) */}
      {state.tool !== "pan" && selected ? (
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
          {state.tool === "pen" && (
            <span className="text-xs text-gray-400">
              앵커 드래그=이동 · 앵커 더블클릭=곡선↔직선 · 핸들 더블클릭=직선화
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-500">{activeHint}</span>
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
