import { SeatViewSeat } from "@/lib/api/seatview";
import { Seat } from "@/components/seatmap/seatTypes";
import { matchSectionSeats, MatchedSeat, seatLabel, seatState } from "../seatMatching";

const lay = (gridRow: number, number: number, available = true): Seat => ({
  id: `${gridRow}-${number}`,
  x: number * 20,
  y: gridRow * 20,
  gridRow,
  number,
  available,
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

test("비가용 앞행이 있으면 판매 좌석은 B열부터 매칭된다", () => {
  const m = matchSectionSeats([lay(0, 1, false), lay(1, 1), lay(1, 2)], [ev(11, "B", 1), ev(12, "B", 2)]);
  expect(m[0].row).toBe("A");
  expect(m[0].event).toBeNull();
  expect(m[1].event?.eventSeatSeq).toBe(11);
  expect(m[2].event?.eventSeatSeq).toBe(12);
});

test("결번 좌석 번호도 number 로 매칭된다", () => {
  const m = matchSectionSeats([lay(0, 1), lay(0, 3)], [ev(3, "A", 3)]);
  expect(m[0].event).toBeNull();
  expect(m[1].event?.eventSeatSeq).toBe(3);
});

describe("seatState 우선순위", () => {
  const match = (e: SeatViewSeat | null): MatchedSeat => ({ seat: lay(0, 1), row: "A", event: e });

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
  const sold = seatLabel({ seat: lay(0, 1), row: "A", event: ev(1, "A", 1) });
  expect(sold).toBe("A열 1번 · VIP");
  expect(sold).not.toContain("원");
  expect(seatLabel({ seat: lay(0, 1), row: "A", event: null })).toBe("A열 1번");
});
