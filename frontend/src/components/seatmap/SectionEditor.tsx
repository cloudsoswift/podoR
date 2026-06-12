"use client";

import { useEffect, useReducer } from "react";
import { editorReducer, initialState } from "./editorReducer";
import { Section } from "./types";
import EditorCanvas from "./EditorCanvas";
import EditorToolbar from "./EditorToolbar";
import JsonPanel from "./JsonPanel";

interface Props {
  // 선택된 섹션의 좌석 편집으로 진입하는 핸들러(통합 화면에서 주입).
  onEditSeats?: (section: Section) => void;
  // 섹션 목록이 바뀔 때마다 상위로 알린다(좌석맵 등록용).
  onSectionsChange?: (sections: Section[]) => void;
}

export default function SectionEditor({ onEditSeats, onSectionsChange }: Props) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // 섹션 목록을 상위(통합 화면)와 동기화한다.
  useEffect(() => {
    onSectionsChange?.(state.sections);
  }, [state.sections, onSectionsChange]);

  // Esc: 그리던 도형 취소 / Delete: 선택 섹션 삭제
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        dispatch({ type: "CANCEL_DRAFT" });
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        state.selectedId
      ) {
        dispatch({ type: "DELETE_SECTION", id: state.selectedId });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedId]);

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        state={state}
        dispatch={dispatch}
        onEditSeats={onEditSeats}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <div className="h-full w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <EditorCanvas state={state} dispatch={dispatch} />
          </div>
        </div>
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-gray-50">
          <JsonPanel state={state} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
