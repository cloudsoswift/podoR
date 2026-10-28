import {
  ensureMinSeatSize,
  fitView,
  INITIAL_VIEW,
  MAX_Z,
  viewCenter,
  viewTransform,
  zoomAround,
} from "../viewport";

test("zoomAround 은 root 점을 고정한다", () => {
  const v = zoomAround(INITIAL_VIEW, 2, { x: 100, y: 50 });
  expect(v).toEqual({ z: 2, tx: -100, ty: -50 });
});

test("zoomAround 은 MAX_Z 에서 멈춘다", () => {
  expect(zoomAround({ tx: 0, ty: 0, z: MAX_Z }, 2, { x: 0, y: 0 }).z).toBe(MAX_Z);
});

test("fitView 는 박스를 화면 중앙에 맞춘다", () => {
  const v = fitView({ minX: 100, minY: 100, maxX: 300, maxY: 200 }, 0);
  expect(v.z).toBe(5); // min(1000/200, 700/100)
  expect(v.tx).toBe(500 - 200 * 5);
  expect(v.ty).toBe(350 - 150 * 5);
});

test("viewTransform 문자열", () => {
  expect(viewTransform({ tx: 1, ty: 2, z: 3 })).toBe("translate(1 2) scale(3)");
});

test("viewCenter: 화면 중앙의 콘텐츠 좌표", () => {
  expect(viewCenter({ tx: 0, ty: 0, z: 1 })).toEqual({ x: 500, y: 350 });
  expect(viewCenter({ tx: -500, ty: -350, z: 2 })).toEqual({ x: 500, y: 350 });
});

describe("ensureMinSeatSize", () => {
  const v = { tx: 0, ty: 0, z: 1 };
  test("가장 작은 좌석 지름이 24px 미만이면 그만큼 확대", () => {
    const out = ensureMinSeatSize(v, 4, 1, { x: 500, y: 350 }); // 지름 8px → 3배
    expect(out.z).toBeCloseTo(3);
    expect(out.tx).toBeCloseTo(500 - 500 * 3);
  });
  test("이미 충분하거나 화면 크기를 모르면 그대로", () => {
    expect(ensureMinSeatSize(v, 20, 1, { x: 0, y: 0 })).toBe(v);
    expect(ensureMinSeatSize(v, 4, 0, { x: 0, y: 0 })).toBe(v);
  });
  test("최대 줌을 넘지 않는다", () => {
    expect(ensureMinSeatSize(v, 0.1, 1, { x: 0, y: 0 }).z).toBe(MAX_Z);
  });
});
