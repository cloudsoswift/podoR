import { useEffect, useRef } from "react";
import { MAX_ROW_NAME_LENGTH } from "@/components/seatmap/core/layoutValidation";
import { rowSeats } from "@/components/seatmap/core/rowGeometry";
import { NumberDirection, SeatRow } from "@/components/seatmap/core/seatTypes";
import { RowEditorAction, RowEditorState } from "./rowEditorReducer";

interface Props {
  state: RowEditorState;
  dispatch: React.Dispatch<RowEditorAction>;
}

const field = "w-full rounded-md border border-gray-300 px-2 py-1 text-sm";

/**
 * 숫자 입력. 입력 중 빈칸·중간값을 허용하려고 비제어로 두고, 포커스를 잃거나 Enter 일 때 반영한다.
 * 부모는 key 에 줄 id 와 값을 넣어 줄이 바뀌거나 값이 반영되면 새로 만든다. 반영 전에 사라지면
 * (입력 중 다른 줄을 고른 경우) 입력하던 줄에 반영한다 — 새로 고른 줄에 섞이지 않는다.
 */
function NumberInput({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onCommit: (v: number) => void;
}) {
  // 아직 반영하지 않은 입력값. 이 입력칸이 사는 동안 같은 줄을 가리키는 onCommit 을 쓴다.
  const pendingRef = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });

  function commit() {
    const raw = pendingRef.current;
    pendingRef.current = null;
    if (raw === null) return;
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) return;
    commitRef.current(Math.min(max ?? Infinity, Math.max(min, n)));
  }

  // 사라질 때 남은 입력을 반영한다.
  useEffect(
    () => () => {
      const raw = pendingRef.current;
      pendingRef.current = null;
      if (raw === null || raw.trim() === "" || !Number.isFinite(Number(raw))) return;
      commitRef.current(Math.min(max ?? Infinity, Math.max(min, Number(raw))));
    },
    [min, max],
  );

  return (
    <label className="block text-xs text-gray-600">
      {label}
      <input
        type="number"
        aria-label={label}
        defaultValue={Math.round(value * 100) / 100}
        min={min}
        max={max}
        onChange={(e) => {
          pendingRef.current = e.target.value;
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={`${field} mt-0.5`}
      />
    </label>
  );
}

/** 좌석 에디터 오른쪽 줄 패널: 저장 좌석 요약 + 선택한 줄의 이름·번호·좌석 수·휨. */
export default function RowPanel({ state, dispatch }: Props) {
  const numbered = state.rows.reduce((n, r) => n + rowSeats(r).filter((s) => s.number !== null).length, 0);
  const selected = state.mode === "row" ? state.selectedRowIds : [];
  const row: SeatRow | undefined =
    selected.length === 1 ? state.rows.find((r) => r.id === selected[0]) : undefined;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-gray-700">
        저장 좌석 {numbered}석 · 줄 {state.rows.length}개
      </h2>

      {row ? (
        <div className="space-y-3">
          <label className="block text-xs text-gray-600">
            줄 이름
            <input
              aria-label="줄 이름"
              maxLength={MAX_ROW_NAME_LENGTH}
              value={row.name}
              placeholder="예: A"
              onChange={(e) => dispatch({ type: "UPDATE_ROW", id: row.id, patch: { name: e.target.value } })}
              className={`${field} mt-0.5 ${row.name.trim() ? "" : "border-amber-400"}`}
            />
          </label>
          <NumberInput
            key={`${row.id}:시작 번호:${row.startNumber}`}
            label="시작 번호"
            value={row.startNumber}
            min={0}
            onCommit={(v) =>
              dispatch({ type: "UPDATE_ROW", id: row.id, patch: { startNumber: Math.floor(v) } })
            }
          />
          <label className="block text-xs text-gray-600">
            번호 방향
            <select
              aria-label="번호 방향"
              value={row.numberDirection}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ROW",
                  id: row.id,
                  patch: { numberDirection: e.target.value as NumberDirection },
                })
              }
              className={`${field} mt-0.5`}
            >
              <option value="forward">첫 좌석부터</option>
              <option value="reverse">끝 좌석부터</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              aria-label="사용 안 하는 좌석은 번호 건너뛰기"
              checked={row.skipUnavailableNumbers}
              onChange={(e) =>
                dispatch({ type: "UPDATE_ROW", id: row.id, patch: { skipUnavailableNumbers: e.target.checked } })
              }
            />
            사용 안 하는 좌석은 번호 건너뛰기
          </label>
          <NumberInput
            key={`${row.id}:좌석 수:${row.seatCount}`}
            label="좌석 수"
            value={row.seatCount}
            min={1}
            onCommit={(v) => dispatch({ type: "SET_ROW_SEAT_COUNT", id: row.id, seatCount: Math.floor(v) })}
          />
          <NumberInput
            key={`${row.id}:휨 각도:${row.arcAngle}`}
            label="휨 각도"
            value={row.arcAngle}
            min={-180}
            max={180}
            onCommit={(v) => dispatch({ type: "SET_ROW_ARC", id: row.id, arcAngle: v })}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          {selected.length > 1
            ? `${selected.length}개 줄 선택`
            : state.mode === "row"
              ? "줄을 클릭하면 이름과 번호를 정할 수 있습니다."
              : "좌석을 클릭하거나 드래그해 사용 여부를 정합니다."}
        </p>
      )}
    </div>
  );
}
