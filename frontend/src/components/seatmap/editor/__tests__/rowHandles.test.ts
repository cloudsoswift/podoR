import { newRow } from "@/components/seatmap/core/rowGeometry";
import { arcFromDrag, rotationFromPoint, rowHandlePositions, scaleFactorFromDrag } from "../rowHandles";

const row5 = () => newRow("r", 5, { x: 100, y: 100 }); // 현 80, 반지름 8

test("rotationFromPoint: 중심 바로 위 = 0, 오른쪽 = 90", () => {
  expect(rotationFromPoint(row5(), { x: 150, y: 100 })).toBeCloseTo(90);
  expect(rotationFromPoint(row5(), { x: 100, y: 50 })).toBeCloseTo(0);
});

test("arcFromDrag: 시작점 대비 위로 끈 만큼 휜다(h = c/2 이면 180°)", () => {
  expect(arcFromDrag(row5(), { x: 100, y: 100 }, { x: 100, y: 60 })).toBeCloseTo(180);
  expect(arcFromDrag(row5(), { x: 100, y: 100 }, { x: 100, y: 120 })).toBeLessThan(0);
  expect(arcFromDrag(newRow("one", 1, { x: 0, y: 0 }), { x: 0, y: 0 }, { x: 0, y: -40 })).toBe(0);
});

test("arcFromDrag: 이미 휜 줄은 지금 휨에서 이어서 변한다(잡는 순간 튀지 않음)", () => {
  const curved = { ...row5(), arcAngle: 90 };
  expect(arcFromDrag(curved, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(90);
});

test("scaleFactorFromDrag: 중심에서의 거리 비", () => {
  expect(scaleFactorFromDrag(row5(), { x: 140, y: 100 }, { x: 180, y: 100 })).toBeCloseTo(2);
});

test("rowHandlePositions: 좌석을 감싼 사각형 꼭짓점과 그 위 회전 핸들", () => {
  const h = rowHandlePositions(row5(), 1);
  expect(h.corners).toEqual([
    { x: 52, y: 92 },
    { x: 148, y: 92 },
    { x: 148, y: 108 },
    { x: 52, y: 108 },
  ]);
  expect(h.rotate).toEqual({ x: 100, y: 68 });
  expect(h.bend.y).toBeGreaterThan(108);
});
