import {
  allSeatsForSave,
  DEFAULT_PITCH,
  pitchFromSeats,
  rowLabelsByGridRow,
  seatRadius,
} from "../seatGeometry";
import { Seat } from "../seatTypes";

const s = (gridRow: number, number: number, available = true): Seat => ({
  id: `${gridRow}-${number}`,
  x: number * 10,
  y: gridRow * 10,
  gridRow,
  number,
  available,
});

test("rowLabelsByGridRow: 비가용 행도 라벨을 차지한다", () => {
  const m = rowLabelsByGridRow([s(2, 1, false), s(5, 1), s(5, 2)]);
  expect(m.get(2)).toBe("A");
  expect(m.get(5)).toBe("B");
});

test("allSeatsForSave 라벨과 rowLabelsByGridRow 가 일치한다", () => {
  const seats = [s(0, 1, false), s(3, 1), s(3, 2, false), s(7, 4)];
  const labels = rowLabelsByGridRow(seats);
  for (const r of allSeatsForSave(seats)) expect(r.row).toBe(labels.get(r.gridRow));
});

test("seatRadius 는 작은 pitch 의 0.4배, 하한 1", () => {
  expect(seatRadius(20, 30)).toBe(8);
  expect(seatRadius(1, 1)).toBe(1);
});

test("pitchFromSeats 는 최근접 거리 최솟값, 좌석 1개 이하면 DEFAULT_PITCH", () => {
  expect(
    pitchFromSeats([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 0, y: 30 },
    ]),
  ).toBe(12);
  expect(pitchFromSeats([{ x: 5, y: 5 }])).toBe(DEFAULT_PITCH);
  expect(pitchFromSeats([])).toBe(DEFAULT_PITCH);
});
