"use client";

import { useEffect, useReducer } from "react";
import { EditorAction, editorReducer, initialState } from "./editorReducer";
import { BackgroundImage, Section } from "@/components/seatmap/core/types";
import EditorCanvas from "./EditorCanvas";
import EditorToolbar from "./EditorToolbar";
import JsonPanel from "./JsonPanel";

interface Props {
  // 로드된 저장 섹션을 주입해 복원한다(통합 화면에서 전달).
  initialSections?: Section[];
  // 선택된 섹션의 좌석 편집으로 진입하는 핸들러(통합 화면에서 주입).
  onEditSeats?: (section: Section) => void;
  // 섹션 목록이 바뀔 때마다 상위로 알린다(좌석맵 등록용).
  onSectionsChange?: (sections: Section[]) => void;
  // 밑그림이 바뀔 때마다 상위로 알린다(줄 에디터에 같은 밑그림을 보여 주기 위해).
  onBackgroundChange?: (background: BackgroundImage | null) => void;
  // 섹션을 평행 이동할 때 이동량을 알린다(그 섹션의 줄도 함께 옮기기 위해).
  onSectionMove?: (id: string, dx: number, dy: number) => void;
  // false 면 키보드 단축키를 받지 않는다(줄 에디터가 열려 이 화면이 숨겨진 동안).
  keyboardEnabled?: boolean;
}

export default function SectionEditor({
  initialSections,
  onEditSeats,
  onSectionsChange,
  onBackgroundChange,
  onSectionMove,
  keyboardEnabled = true,
}: Props) {
  const [state, rawDispatch] = useReducer(editorReducer, initialState);

  // 섹션 이동은 디스패치 직전에 상위로 알린다.
  function dispatch(action: EditorAction) {
    if (action.type === "MOVE_SECTION") onSectionMove?.(action.id, action.dx, action.dy);
    rawDispatch(action);
  }

  // 저장된 섹션을 한 번 주입(로드 완료 후). LOAD_SECTIONS 는 sections 를 통째로 교체한다.
  useEffect(() => {
    if (initialSections && initialSections.length > 0) {
      rawDispatch({ type: "LOAD_SECTIONS", sections: initialSections });
    }
  }, [initialSections]);

  useEffect(() => {
    onBackgroundChange?.(state.background);
  }, [state.background, onBackgroundChange]);

  // 섹션 목록을 상위(통합 화면)와 동기화한다.
  useEffect(() => {
    onSectionsChange?.(state.sections);
  }, [state.sections, onSectionsChange]);

  // Esc: 그리던 도형 취소 / Delete: 선택 섹션 삭제
  useEffect(() => {
    if (!keyboardEnabled) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        rawDispatch({ type: "CANCEL_DRAFT" });
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        state.selectedId
      ) {
        rawDispatch({ type: "DELETE_SECTION", id: state.selectedId });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedId, keyboardEnabled]);

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
