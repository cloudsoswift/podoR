import { SeatViewSeat } from "@/lib/api/seatview";
import { rowLabelsByGridRow } from "@/components/seatmap/seatGeometry";
import { Seat } from "@/components/seatmap/seatTypes";

// unsold = 회차 좌석이 없음(에디터 비가용 / 미등급 / 제외 좌석).
export type SeatState = "available" | "held" | "sold" | "unsold" | "selected";

export interface MatchedSeat {
  seat: Seat; // layoutJson 좌석(x/y)
  row: string; // 행 라벨(A, B…)
  event: SeatViewSeat | null; // 매칭된 회차 좌석
}

export const SEAT_COLORS: Record<SeatState, string> = {
  available: "#34d399", // emerald-400
  held: "#fcd34d", // amber-300
  sold: "#d1d5db", // gray-300
  unsold: "#d1d5db",
  selected: "#4f46e5", // indigo-600
};

/**
 * 섹션의 layoutJson 좌석과 회차 좌석을 (행 라벨, 좌석 번호)로 짝짓는다.
 * 행 라벨은 저장 시(allSeatsForSave)와 같은 규칙이라야 Seat 테이블의 row_number 와 일치한다.
 */
export function matchSectionSeats(
  layoutSeats: Seat[],
  sectionEventSeats: SeatViewSeat[],
): MatchedSeat[] {
  const labels = rowLabelsByGridRow(layoutSeats);
  const byKey = new Map(sectionEventSeats.map((e) => [`${e.rowNumber}-${e.seatNumber}`, e]));
  return layoutSeats.map((seat) => {
    const row = labels.get(seat.gridRow) ?? "A";
    return { seat, row, event: byKey.get(`${row}-${seat.number}`) ?? null };
  });
}

export function seatState(m: MatchedSeat, held: Set<number>, selected: Set<number>): SeatState {
  if (!m.event) return "unsold";
  if (m.event.status === "SOLD") return "sold";
  if (held.has(m.event.eventSeatSeq)) return "held";
  if (selected.has(m.event.eventSeatSeq)) return "selected";
  return "available";
}

/** 호버 라벨. 가격은 표시하지 않는다. */
export function seatLabel(m: MatchedSeat): string {
  const base = `${m.row}열 ${m.seat.number}번`;
  return m.event ? `${base} · ${m.event.grade}` : base;
}
