import { SeatViewSeat } from "@/lib/api/seatview";
import { rowSeats } from "@/components/seatmap/core/rowGeometry";
import { RowSeat, SeatRow } from "@/components/seatmap/core/seatTypes";

// unsold = 회차 좌석이 없음(에디터 사용 안 함 / 미등급 / 제외 좌석).
export type SeatState = "available" | "held" | "sold" | "unsold" | "selected";

export interface MatchedSeat {
  seat: RowSeat; // 줄에서 계산한 좌석(좌표·반지름·번호)
  row: string; // 줄 이름
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
 * 섹션의 줄 좌석과 회차 좌석을 (줄 이름, 좌석 번호)로 짝짓는다.
 * 저장 시 Seat 테이블에 들어간 키(row_number = 줄 이름)와 같은 규칙이다. 번호 없는 좌석은 짝이 없다.
 */
export function matchSectionSeats(rows: SeatRow[], sectionEventSeats: SeatViewSeat[]): MatchedSeat[] {
  const byKey = new Map(sectionEventSeats.map((e) => [`${e.rowNumber}-${e.seatNumber}`, e]));
  return rows.flatMap((row) => {
    const name = row.name.trim(); // 저장 시(buildSeatmapPayload)와 같은 이름
    return rowSeats(row).map((seat) => ({
      seat,
      row: name,
      event: seat.number === null ? null : (byKey.get(`${name}-${seat.number}`) ?? null),
    }));
  });
}

export function seatState(m: MatchedSeat, held: Set<number>, selected: Set<number>): SeatState {
  if (!m.event) return "unsold";
  if (m.event.status === "SOLD") return "sold";
  if (held.has(m.event.eventSeatSeq)) return "held";
  if (selected.has(m.event.eventSeatSeq)) return "selected";
  return "available";
}

/** 호버 라벨. 가격은 표시하지 않는다. 번호가 없으면 줄 이름만. */
export function seatLabel(m: MatchedSeat): string {
  const base = m.seat.number === null ? `${m.row}열` : `${m.row}열 ${m.seat.number}번`;
  return m.event ? `${base} · ${m.event.grade}` : base;
}
