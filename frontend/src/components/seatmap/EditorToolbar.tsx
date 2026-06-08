import { useRef } from "react";
import { EditorAction, EditorState } from "./editorReducer";
import { Section, Tool } from "./types";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // 선택 섹션의 좌석 편집으로 진입(통합 화면에서만 주입). 없으면 버튼을 숨긴다.
  onEditSeats?: (section: Section) => void;
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
    hint: "빈 곳을 클릭해 점을 찍고 첫 점을 다시 클릭하면 닫힙니다(최소 3점). Shift 를 누르면 직각으로 각도가 고정됩니다. 섹션을 클릭하면 앵커를 편집합니다.",
  },
];

export default function EditorToolbar({
  state,
  dispatch,
  onEditSeats,
}: Props) {
  const selected: Section | undefined = state.sections.find(
    (s) => s.id === state.selectedId,
  );
  const activeHint = TOOLS.find((t) => t.tool === state.tool)?.hint;
  const bg = state.background;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        dispatch({
          type: "SET_BACKGROUND",
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

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
          {onEditSeats && (
            <button
              type="button"
              onClick={() => onEditSeats(selected)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              title="이 섹션의 좌석맵을 편집합니다."
            >
              좌석 편집 →
            </button>
          )}
          {state.tool === "pen" && (
            <span className="text-xs text-gray-400">
              앵커 드래그=이동 · 앵커 더블클릭=곡선↔직선 · 핸들 더블클릭=직선화
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-500">{activeHint}</span>
      )}

      {/* 배경 밑그림(설계도) 컨트롤 */}
      <div className="ml-auto flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {!bg ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
            title="공연장 설계도를 밑그림으로 올려 섹션을 따라 그립니다."
          >
            배경 추가
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1">
            <span className="text-xs font-medium text-gray-500">배경</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bg.opacity}
              onChange={(e) =>
                dispatch({
                  type: "SET_BACKGROUND_OPACITY",
                  opacity: Number(e.target.value),
                })
              }
              className="w-20 cursor-pointer"
              aria-label="배경 투명도"
              title="배경 투명도"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "FIT_BACKGROUND" })}
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              title="공연장 해상도에 맞춰 다시 맞춥니다."
            >
              맞추기
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_BACKGROUND_LOCKED",
                  locked: !bg.locked,
                })
              }
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                bg.locked
                  ? "text-gray-600 hover:bg-gray-100"
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              }`}
              title={
                bg.locked
                  ? "잠금됨 — 클릭하면 위치/크기를 편집합니다."
                  : "편집 중 — 클릭하면 잠가서 위에 그릴 수 있습니다."
              }
            >
              {bg.locked ? "잠금" : "편집 중"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "REMOVE_BACKGROUND" })}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              제거
            </button>
          </div>
        )}
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
