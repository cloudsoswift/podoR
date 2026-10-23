import {
  findDuplicateSeatNumbers,
  findSeatOverlaps,
  findSeatsOutside,
  findSectionOverlaps,
  findUnnamedRows,
  validateLayout,
} from "../layoutValidation";
import { flattenSection, pointInPolygon, polygonOf } from "../seatGeometry";
import { newRow, rowSeats } from "../rowGeometry";
import { Section } from "../types";

const a = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const square = (id: string, name: string, x: number, y: number, s: number): Section => ({
  id,
  name,
  color: "#000",
  anchors: [a(`${id}1`, x, y), a(`${id}2`, x + s, y), a(`${id}3`, x + s, y + s), a(`${id}4`, x, y + s)],
});

test("bezier bulge: 앵커 다각형 밖이지만 곡선 안쪽인 점은 flattenSection 안", () => {
  const sec = square("s", "S", 0, 0, 100);
  // 오른쪽 변을 바깥으로 볼록하게.
  sec.anchors[1] = { ...sec.anchors[1], handleOut: { x: 160, y: 30 } };
  sec.anchors[2] = { ...sec.anchors[2], handleIn: { x: 160, y: 70 } };
  const p = { x: 110, y: 50 };
  expect(pointInPolygon(p, polygonOf(sec))).toBe(false);
  expect(pointInPolygon(p, flattenSection(sec))).toBe(true);
  const seat = { rowId: "r", index: 0, x: 110, y: 50, r: 2, available: true, number: 1 };
  expect(findSeatsOutside(sec, [seat]).size).toBe(0);
});

test("좌석 겹침: 같은 자리 복제는 겹침, 맞닿음(거리 = 2r)은 아님", () => {
  const r1 = newRow("r1", 3, { x: 100, y: 100 });
  expect(findSeatOverlaps([...rowSeats(r1), ...rowSeats({ ...r1, id: "r2" })]).size).toBe(6);
  // 간격 20, 반지름 10 → 이웃끼리 맞닿기만 한다.
  expect(findSeatOverlaps(rowSeats({ ...r1, seatRadius: 10 })).size).toBe(0);
});

test("섹션 밖: 원이 경계를 넘으면 밖", () => {
  const sec = square("s", "S", 0, 0, 100);
  const seat = (x: number) => ({ rowId: "r", index: x, x, y: 50, r: 8, available: true, number: 1 });
  expect([...findSeatsOutside(sec, [seat(50), seat(95)])]).toEqual(["r#95"]);
});

test("(줄 이름, 번호) 중복: 이어지는 조각은 허용, 같은 번호는 충돌", () => {
  const left = { ...newRow("L", 10, { x: 100, y: 100 }), name: "A" };
  const right = { ...newRow("R", 10, { x: 400, y: 100 }), name: "A", startNumber: 11 };
  expect(findDuplicateSeatNumbers([left, right]).size).toBe(0);
  expect(findDuplicateSeatNumbers([left, { ...right, startNumber: 10 }])).toEqual(new Set(["L#9", "R#0"]));
  expect(findUnnamedRows([left, newRow("N", 2, { x: 0, y: 0 })])).toEqual(new Set(["N"]));
});

test("섹션 겹침: 교차·포함·일치는 겹침, 변 공유는 아님", () => {
  expect(findSectionOverlaps([square("a", "A", 0, 0, 100), square("b", "B", 50, 50, 100)])).toEqual(
    new Set(["a", "b"]),
  );
  expect(findSectionOverlaps([square("a", "A", 0, 0, 100), square("b", "B", 100, 0, 100)]).size).toBe(0);
  expect(findSectionOverlaps([square("a", "A", 0, 0, 100), square("b", "B", 20, 20, 10)])).toEqual(
    new Set(["a", "b"]),
  );
  expect(findSectionOverlaps([square("a", "A", 0, 0, 100), square("b", "B", 0, 0, 100)])).toEqual(
    new Set(["a", "b"]),
  );
});

test("섹션 겹침: 변이 같은 직선 위에 놓인 부분 겹침도 잡는다", () => {
  const rect = (id: string, x0: number, y0: number, x1: number, y1: number): Section => ({
    id,
    name: id,
    color: "#000",
    anchors: [a(`${id}1`, x0, y0), a(`${id}2`, x1, y0), a(`${id}3`, x1, y1), a(`${id}4`, x0, y1)],
  });
  expect(findSectionOverlaps([rect("a", 0, 0, 100, 100), rect("b", 0, 80, 100, 180)])).toEqual(new Set(["a", "b"]));
  expect(findSectionOverlaps([rect("a", 0, 0, 10, 10), rect("b", 5, 0, 15, 10)])).toEqual(new Set(["a", "b"]));
  // 꼭짓점만 닿거나 변을 공유하는 것은 겹침이 아니다.
  expect(findSectionOverlaps([rect("a", 0, 0, 10, 10), rect("b", 10, 10, 20, 20)]).size).toBe(0);
  expect(findSectionOverlaps([rect("a", 0, 0, 10, 10), rect("b", 0, 10, 10, 20)]).size).toBe(0);
});

test("validateLayout: 사유 메시지", () => {
  const sec = square("s", "A구역", 0, 0, 300);
  const row = newRow("r1", 3, { x: 100, y: 100 });
  expect(validateLayout([sec], { s: [row, { ...row, id: "r2" }] })).toEqual([
    "A구역: 이름 없는 줄 2개",
    "A구역: 겹친 좌석 6석",
  ]);
  expect(validateLayout([sec], { s: [{ ...row, name: "A" }], gone: [row] })).toEqual([]);
  expect(validateLayout([sec, square("t", "B구역", 100, 100, 300)], {})).toEqual([
    "겹친 섹션: A구역, B구역",
  ]);
});

test("줄 이름은 앞뒤 공백을 빼고 10자까지(백엔드 row_number 길이)", () => {
  const sec = square("s", "A구역", 0, 0, 300);
  const long = { ...newRow("r1", 2, { x: 100, y: 100 }), name: "12345678901" };
  expect(validateLayout([sec], { s: [long] })).toEqual(["A구역: 줄 이름이 10자를 넘는 줄 1개"]);
  const padded = { ...newRow("r2", 2, { x: 100, y: 100 }), name: " 1234567890 " };
  expect(validateLayout([sec], { s: [padded] })).toEqual([]);
});
