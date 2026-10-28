import { SeatViewSeat } from "@/lib/api/seatview";
import { newRow, rowSeats } from "@/components/seatmap/core/rowGeometry";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { matchSectionSeats, MatchedSeat, seatLabel, seatState } from "../seatMatching";

const row = (patch: Partial<SeatRow> = {}): SeatRow => ({
  ...newRow("r", 3, { x: 40, y: 20 }),
  name: "A",
  ...patch,
});

const ev = (
  seq: number,
  rowNumber: string,
  seatNumber: number,
  status: SeatViewSeat["status"] = "AVAILABLE",
): SeatViewSeat => ({
  eventSeatSeq: seq,
  section: "A구역",
  rowNumber,
  seatNumber,
  grade: "VIP",
  price: 10000,
  status,
  changeVersion: 0,
});

test("(줄 이름, 번호)로 매칭: 시작 번호 15 인 줄", () => {
  const m = matchSectionSeats([row({ startNumber: 15 })], [ev(15, "A", 15), ev(17, "A", 17), ev(99, "B", 15)]);
  expect(m.map((x) => x.event?.eventSeatSeq ?? null)).toEqual([15, null, 17]);
  expect(m.map((x) => x.row)).toEqual(["A", "A", "A"]);
});

test("건너뛰기로 번호가 없는 좌석은 매칭되지 않고 라벨은 줄 이름만", () => {
  const m = matchSectionSeats(
    [row({ unavailable: [1], skipUnavailableNumbers: true })],
    [ev(1, "A", 1), ev(2, "A", 2)],
  );
  expect(m[1].seat.number).toBeNull();
  expect(m[1].event).toBeNull();
  expect(seatLabel(m[1])).toBe("A열");
  expect(m[2].event?.eventSeatSeq).toBe(2);
});

describe("seatState 우선순위", () => {
  const seat = rowSeats(row())[0];
  const match = (e: SeatViewSeat | null): MatchedSeat => ({ seat, row: "A", event: e });

  test("판매완료는 선택보다 우선", () => {
    expect(seatState(match(ev(1, "A", 1, "SOLD")), new Set(), new Set([1]))).toBe("sold");
  });
  test("선점중은 선택보다 우선", () => {
    expect(seatState(match(ev(1, "A", 1)), new Set([1]), new Set([1]))).toBe("held");
  });
  test("회차 좌석이 없으면 판매하지 않는 좌석", () => {
    expect(seatState(match(null), new Set(), new Set())).toBe("unsold");
  });
  test("예매가능 + 선택", () => {
    expect(seatState(match(ev(1, "A", 1)), new Set(), new Set([1]))).toBe("selected");
    expect(seatState(match(ev(1, "A", 1)), new Set(), new Set())).toBe("available");
  });
});

test("seatLabel 은 가격 없이 등급만", () => {
  const seat = rowSeats(row())[0];
  const sold = seatLabel({ seat, row: "A", event: ev(1, "A", 1) });
  expect(sold).toBe("A열 1번 · VIP");
  expect(sold).not.toContain("원");
  expect(seatLabel({ seat, row: "A", event: null })).toBe("A열 1번");
});

test("줄 이름의 앞뒤 공백은 빼고 매칭한다(저장 시와 같은 규칙)", () => {
  const m = matchSectionSeats([row({ name: " A " })], [ev(1, "A", 1)]);
  expect(m[0].event?.eventSeatSeq).toBe(1);
  expect(m[0].row).toBe("A");
});
