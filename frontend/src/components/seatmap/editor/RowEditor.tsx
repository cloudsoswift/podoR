"use client";

import { useEffect, useMemo, useReducer } from "react";
import { genId } from "@/components/seatmap/core/geometry";
import { boundsOf, flattenSection } from "@/components/seatmap/core/seatGeometry";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { BackgroundImage, Section } from "@/components/seatmap/core/types";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { fitView, viewCenter } from "@/components/seatmap/core/viewport";
import RowCanvas from "./RowCanvas";
import { createRowEditorState, rowEditorReducer } from "./rowEditorReducer";
import RowPanel from "./RowPanel";
import RowToolbar from "./RowToolbar";

interface Props {
  section: Section;
  // 통합 화면에서 이미 만들어 둔 줄을 이어서 편집할 때 주입한다.
  initialRows?: SeatRow[];
  // 섹션 에디터의 밑그림(읽기 전용).
  background?: BackgroundImage | null;
  // 섹션 에디터로 돌아갈 때 현재 줄을 넘겨 보존시킨다.
  onExit?: (rows: SeatRow[]) => void;
  // 줄이 바뀔 때마다 알린다(상단 저장 바가 편집 중에도 최신 줄로 검증·저장하도록). 참조가 안정적이어야 한다.
  onRowsChange?: (rows: SeatRow[]) => void;
}

/** 줄 단위 좌석 에디터: 툴바 + 캔버스 + 줄 패널. 섹션 영역에 맞춘 화면으로 시작한다. */
export default function RowEditor({ section, initialRows, background, onExit, onRowsChange }: Props) {
  const [state, dispatch] = useReducer(rowEditorReducer, undefined, () =>
    createRowEditorState(section, initialRows ?? []),
  );
  const initialView = useMemo(() => fitView(boundsOf(flattenSection(section))), [section]);
  const pz = usePanZoom(initialView);
  const { viewRef } = pz;

  useEffect(() => {
    onRowsChange?.(state.rows);
  }, [state.rows, onRowsChange]);

  // Ctrl+D 복제 / Delete 삭제(좌석 모드는 사용 안 함) / Esc 선택 해제.
  // Ctrl+D 는 입력칸에서도 처리한다(이름 입력 후 바로 복제, 북마크 창 방지). 나머지는 입력칸에서 무시한다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const rowMode = state.mode === "row";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault(); // 브라우저 북마크 단축키
        if (e.repeat || !rowMode || state.selectedRowIds.length === 0) return;
        const first = state.rows.find((r) => r.id === state.selectedRowIds[0]);
        dispatch({
          type: "DUPLICATE_ROWS",
          ids: state.selectedRowIds,
          newIds: state.selectedRowIds.map(() => genId()),
          dx: 0,
          dy: first?.spacing ?? 0,
        });
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (rowMode) dispatch({ type: "DELETE_ROWS", ids: state.selectedRowIds });
        else dispatch({ type: "SET_SEATS_AVAILABLE", keys: state.selectedSeatKeys, available: false });
      } else if (e.key === "Escape") {
        if (rowMode) dispatch({ type: "SELECT_ROWS", ids: [] });
        else dispatch({ type: "SELECT_SEATS", keys: [] });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.mode, state.rows, state.selectedRowIds, state.selectedSeatKeys]);

  return (
    <div className="flex h-full flex-col">
      <RowToolbar
        state={state}
        dispatch={dispatch}
        onAddRow={(seatCount) =>
          dispatch({ type: "ADD_ROW", id: genId(), seatCount, center: viewCenter(viewRef.current) })
        }
        onExit={onExit ? () => onExit(state.rows) : undefined}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <div className="h-full w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <RowCanvas pz={pz} state={state} dispatch={dispatch} background={background} />
          </div>
        </div>
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-gray-50">
          <RowPanel state={state} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
