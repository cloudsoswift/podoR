import {
  fitView,
  INITIAL_VIEW,
  MAX_Z,
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
