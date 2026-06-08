"use client";

import { useEffect, useReducer } from "react";
import {
  createInitialState,
  seatEditorReducer,
} from "./seatEditorReducer";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import SeatCanvas from "./SeatCanvas";
import SeatToolbar from "./SeatToolbar";
import SeatJsonPanel from "./SeatJsonPanel";

interface Props {
  // 편집 대상 섹션(경계). 없으면 샘플 섹션을 사용한다.
  section?: Section;
  // 통합 화면에서 이미 만들어 둔 좌석을 이어서 편집할 때 주입한다.
  initialSeats?: Seat[];
  // 섹션 에디터로 돌아갈 때 현재 좌석을 넘겨 보존시킨다.
  onExit?: (seats: Seat[]) => void;
}

export default function SeatEditor({ section, initialSeats, onExit }: Props) {
  const [state, dispatch] = useReducer(seatEditorReducer, undefined, () => {
    const base = createInitialState(section);
    return initialSeats ? { ...base, seats: initialSeats } : base;
  });

  // Delete: 선택 좌석을 '사용 안 함'으로 / Esc: 선택 해제.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        dispatch({
          type: "SET_SEATS_AVAILABLE",
          ids: state.selectedIds,
          available: false,
        });
      } else if (e.key === "Escape") {
        dispatch({ type: "SET_SELECTION", ids: [] });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedIds]);

  return (
    <div className="flex h-full flex-col">
      <SeatToolbar
        state={state}
        dispatch={dispatch}
        onExit={onExit ? () => onExit(state.seats) : undefined}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <div className="h-full w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <SeatCanvas state={state} dispatch={dispatch} />
          </div>
        </div>
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-gray-50">
          <SeatJsonPanel state={state} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
