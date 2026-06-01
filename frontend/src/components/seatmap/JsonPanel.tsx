import { useState } from "react";
import { isValidSections } from "./geometry";
import { EditorAction, EditorState } from "./editorReducer";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export default function JsonPanel({ state, dispatch }: Props) {
  const exported = JSON.stringify(state.sections, null, 2);
  const [draft, setDraft] = useState(exported);
  const [error, setError] = useState<string | null>(null);

  // 외부에서 sections 가 바뀌면(그리기/편집) textarea 를 동기화.
  // 렌더 중 상태 조정 패턴(useEffect 없이) — https://react.dev/learn/you-might-not-need-an-effect
  const [prevExported, setPrevExported] = useState(exported);
  if (exported !== prevExported) {
    setPrevExported(exported);
    setDraft(exported);
    setError(null);
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(draft);
      if (!isValidSections(parsed)) {
        setError("형식이 올바르지 않습니다. Section[] 구조여야 합니다.");
        return;
      }
      dispatch({ type: "LOAD_SECTIONS", sections: parsed });
      setError(null);
    } catch {
      setError("JSON 파싱에 실패했습니다.");
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(exported);
  }

  function handleDownload() {
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seatmap-sections.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          JSON ({state.sections.length}개 섹션)
        </h2>
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
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none rounded-md border border-gray-300 p-2 font-mono text-xs text-gray-700"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleImport}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        JSON 불러오기
      </button>
    </div>
  );
}
