import {
  DEFAULT_SEAT_RADIUS,
  MAX_SEAT_RADIUS,
  newRow,
  rowChord,
  rowSeats,
  scaleRow,
  seatKey,
  setRowArc,
  setRowSeatCount,
  translateRows,
} from "../rowGeometry";

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const row5 = () => newRow("r1", 5, { x: 100, y: 100 });

test("newRow: 직선 5석, 간격 20, 번호 1..5", () => {
  const s = rowSeats(row5());
  expect(s.map((p) => p.x)).toEqual([60, 80, 100, 120, 140]);
  expect(s.every((p) => p.y === 100 && p.r === DEFAULT_SEAT_RADIUS)).toBe(true);
  expect(s.map((p) => p.number)).toEqual([1, 2, 3, 4, 5]);
  expect(row5().name).toBe("");
});

test("rotation 90: 첫 좌석이 중심 위쪽(로컬 −x → 월드 −y)", () => {
  const s = rowSeats({ ...row5(), rotation: 90 });
  near(s[0].x, 100);
  near(s[0].y, 60);
  near(s[4].y, 140);
});

test("번호: 시작 15, 역방향, 1번 인덱스 사용 안 함", () => {
  const base = { ...row5(), startNumber: 15, numberDirection: "reverse" as const, unavailable: [1] };
  expect(rowSeats({ ...base, skipUnavailableNumbers: true }).map((p) => p.number)).toEqual([
    18, null, 17, 16, 15,
  ]);
  expect(rowSeats(base).map((p) => p.number)).toEqual([19, 18, 17, 16, 15]);
  expect(rowSeats(base)[1].available).toBe(false);
});

test("setRowArc: 현·중심·반지름 유지, 위로 볼록, 이웃 간격 같고 20 이상", () => {
  const s = rowSeats(setRowArc(row5(), 90));
  near(s[0].x, 60);
  near(s[0].y, 100);
  near(s[4].x, 140);
  near(s[4].y, 100);
  expect(s[2].y).toBeLessThan(100);
  const d = s.slice(1).map((p, i) => Math.hypot(p.x - s[i].x, p.y - s[i].y));
  d.forEach((v) => near(v, d[0]));
  expect(d[0]).toBeGreaterThanOrEqual(20);
  expect(s[0].r).toBe(DEFAULT_SEAT_RADIUS);
  near(rowChord(setRowArc(row5(), 90)), 80);
});

test("tiny arc: 1e-9° 는 직선과 같은 좌표", () => {
  const a = rowSeats(setRowArc(row5(), 1e-9));
  const b = rowSeats(row5());
  a.forEach((p, i) => {
    near(p.x, b[i].x);
    near(p.y, b[i].y);
  });
});

test("setRowSeatCount: 끝 쪽으로 추가/삭제, 첫 좌석·크기 유지, 범위 밖 unavailable 제거", () => {
  const grown = rowSeats(setRowSeatCount(row5(), 7));
  grown.forEach((p, i) => near(p.x, 60 + i * 20));
  const shrunk = setRowSeatCount({ ...row5(), unavailable: [1, 4] }, 3);
  expect(shrunk.unavailable).toEqual([1]);
  near(rowSeats(shrunk)[0].x, 60);
});

test("setRowSeatCount 곡선: 같은 원을 따라 늘어나 θ 가 (n−1)/(N−1) 배", () => {
  const curved = setRowArc(row5(), 90);
  const before = rowSeats(curved);
  const after7 = setRowSeatCount(curved, 7);
  const s = rowSeats(after7);
  near(after7.arcAngle, 135);
  near(s[0].x, before[0].x);
  near(s[0].y, before[0].y);
  near(
    Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y),
    Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y),
  );
});

test("seatCount 1: 중심에 한 좌석, 휨은 0 유지", () => {
  const one = newRow("r", 1, { x: 10, y: 20 });
  expect(rowSeats(one).map((p) => [p.x, p.y])).toEqual([[10, 20]]);
  expect(setRowArc(one, 90).arcAngle).toBe(0);
  expect(scaleRow(one, 2).seatRadius).toBe(16);
});

test("scaleRow: 크기·간격 같은 배율, 상한에서 고정", () => {
  const big = scaleRow(row5(), 2);
  expect([big.seatRadius, big.spacing]).toEqual([16, 40]);
  const clamped = scaleRow(row5(), 100);
  expect(clamped.seatRadius).toBe(MAX_SEAT_RADIUS);
  expect(clamped.spacing).toBe(60);
});

test("translateRows: 지정한 줄만 이동, null 이면 전부", () => {
  const rows = [row5(), newRow("r2", 2, { x: 0, y: 0 })];
  expect(translateRows(rows, new Set(["r2"]), 5, 6).map((r) => r.center)).toEqual([
    { x: 100, y: 100 },
    { x: 5, y: 6 },
  ]);
  expect(translateRows(rows, null, 1, 1)[0].center).toEqual({ x: 101, y: 101 });
  expect(seatKey("r2", 3)).toBe("r2#3");
});
