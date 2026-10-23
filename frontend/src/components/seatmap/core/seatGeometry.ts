import { Anchor, Point, Section } from "./types";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// 곡선 변을 폴리라인으로 펼 때 세그먼트당 샘플 수.
const SEG_STEPS = 12;

/** 섹션 앵커를 직선 폴리곤 꼭짓점으로 본다(내부 판정용). */
export function polygonOf(section: Section): Point[] {
  return section.anchors.map((a) => ({ x: a.x, y: a.y }));
}

export function boundsOf(points: Point[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** 점이 폴리곤 내부에 있는지 — 레이 캐스팅(짝/홀 규칙). */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt,
    b = 3 * mt * mt * t,
    c = 3 * mt * t * t,
    d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** 앵커 a→b 세그먼트를 steps 등분해 펼친다(시작점 제외, 끝점 포함). 곡선이면 베지에. */
function sampleSegment(a: Anchor, b: Anchor, steps: number): Point[] {
  const out: Point[] = [];
  const straight = !a.handleOut && !b.handleIn;
  if (straight) {
    for (let i = 1; i <= steps; i++) out.push(lerp(a, b, i / steps));
    return out;
  }
  const c1 = a.handleOut ?? { x: a.x, y: a.y };
  const c2 = b.handleIn ?? { x: b.x, y: b.y };
  for (let i = 1; i <= steps; i++) out.push(cubicAt(a, c1, c2, b, i / steps));
  return out;
}

/**
 * 섹션 외곽선을 다각형으로 펼친다. 곡선 변만 SEG_STEPS 등분하고 직선 변은 끝점만 둔다
 * (변을 공유하는 섹션끼리 꼭짓점이 상대 변 위에 생기지 않도록).
 */
export function flattenSection(section: Section): Point[] {
  const a = section.anchors;
  const out: Point[] = [];
  for (let i = 0; i < a.length; i++) {
    const cur = a[i];
    const next = a[(i + 1) % a.length];
    if (!cur.handleOut && !next.handleIn) out.push({ x: next.x, y: next.y });
    else out.push(...sampleSegment(cur, next, SEG_STEPS));
  }
  return out;
}
