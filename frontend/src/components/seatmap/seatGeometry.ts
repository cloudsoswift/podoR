import { clamp, genId } from "./geometry";
import { Anchor, Point, Section } from "./types";
import { GridConfig, Seat } from "./seatTypes";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// 격자 간격의 하한(px).
export const MIN_PITCH = 6;
// 곡선 변을 폴리라인으로 펼 때 세그먼트당 샘플 수.
const SEG_STEPS = 12;
// 안전 상한(행/열).
const MAX_LINES = 200;

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

/** 엑셀식 행 라벨: 0→A, 25→Z, 26→AA. */
export function rowLabel(index: number): string {
  let s = "";
  let x = index + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || "A";
}

/**
 * 저장용 좌석 목록(사용 좌석만)으로 정규화한다.
 * - 행: 사용 좌석이 있는 행만 위→아래로 모아 A,B,C… 재부여(빈 앞행/중간행으로 인한 결번 없음).
 * - 열 번호: 생성 시 번호 유지(미사용 좌석으로 인한 결번은 그대로 둠).
 */
export function compactUsedSeats(
  seats: Seat[],
): { gridRow: number; row: string; number: number }[] {
  const used = seats.filter((s) => s.available);
  const rowsPresent = [...new Set(used.map((s) => s.gridRow))].sort(
    (a, b) => a - b,
  );
  const labelByRow = new Map(rowsPresent.map((gr, i) => [gr, rowLabel(i)]));
  return used
    .slice()
    .sort((a, b) => a.gridRow - b.gridRow || a.number - b.number)
    .map((s) => ({
      gridRow: s.gridRow,
      row: labelByRow.get(s.gridRow) ?? "A",
      number: s.number,
    }));
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

/** 루프를 따라 앵커 i0→i1 까지의 외곽선을 폴리라인으로 만든다(곡선 포함). */
function chainBetween(anchors: Anchor[], i0: number, i1: number): Point[] {
  const n = anchors.length;
  const pts: Point[] = [{ x: anchors[i0].x, y: anchors[i0].y }];
  let i = i0;
  while (i !== i1) {
    const j = (i + 1) % n;
    pts.push(...sampleSegment(anchors[i], anchors[j], SEG_STEPS));
    i = j;
  }
  return pts;
}

function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** 폴리라인을 호 길이 기준으로 t∈[0,1] 위치 점으로 매핑하는 함수. */
function arcSampler(pts: Point[]): (t: number) => Point {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;
  return (t) => {
    const d = clamp(t, 0, 1) * total;
    let i = 1;
    while (i < cum.length && cum[i] < d) i++;
    if (i >= pts.length) return pts[pts.length - 1];
    const seg = cum[i] - cum[i - 1] || 1;
    return lerp(pts[i - 1], pts[i], (d - cum[i - 1]) / seg);
  };
}

/**
 * 섹션 외곽에서 4개의 코너 앵커 인덱스를 찾는다(루프 순서, 오름차순).
 * 앵커가 4개면 그대로, 더 많으면 꺾임(turn) 각이 큰 상위 4개를 코너로 본다.
 * 4개 미만이면 null(loft 불가 → 축 정렬 격자 폴백).
 */
function detectCorners(anchors: Anchor[]): [number, number, number, number] | null {
  const n = anchors.length;
  if (n < 4) return null;
  if (n === 4) return [0, 1, 2, 3];
  const turn = anchors.map((p, i) => {
    const prev = anchors[(i - 1 + n) % n];
    const next = anchors[(i + 1) % n];
    const a1 = Math.atan2(p.y - prev.y, p.x - prev.x);
    const a2 = Math.atan2(next.y - p.y, next.x - p.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  const idx = anchors
    .map((_, i) => i)
    .sort((a, b) => turn[b] - turn[a])
    .slice(0, 4)
    .sort((a, b) => a - b);
  return [idx[0], idx[1], idx[2], idx[3]];
}

/** 섹션 바운딩 박스에 축 정렬 격자를 깐다(코너 검출 실패 시 폴백). */
function axisGrid(section: Section, cfg: GridConfig): Seat[] {
  const poly = polygonOf(section);
  if (poly.length < 3) return [];
  const b = boundsOf(poly);
  const colPitch = Math.max(MIN_PITCH, cfg.colPitch);
  const rowPitch = Math.max(MIN_PITCH, cfg.rowPitch);
  const cols = Math.min(MAX_LINES, Math.max(1, Math.floor((b.maxX - b.minX) / colPitch) + 1));
  const rows = Math.min(MAX_LINES, Math.max(1, Math.floor((b.maxY - b.minY) / rowPitch) + 1));
  const x0 = (b.minX + b.maxX) / 2 - ((cols - 1) * colPitch) / 2;
  const y0 = (b.minY + b.maxY) / 2 - ((rows - 1) * rowPitch) / 2;
  const seats: Seat[] = [];
  for (let r = 0; r < rows; r++) {
    let num = 0;
    for (let c = 0; c < cols; c++) {
      const p = { x: x0 + c * colPitch, y: y0 + r * rowPitch };
      if (pointInPolygon(p, poly)) {
        num++;
        seats.push({ id: genId(), x: p.x, y: p.y, gridRow: r, number: num, available: true });
      }
    }
  }
  return seats;
}

/**
 * 섹션 모양(기울어짐·곡선)을 따라 좌석을 깐다.
 * 외곽을 4변(top/right/bottom/left)으로 나눠 Coons 패치로 (행 v, 열 u) 격자를 매핑하고,
 * 폴리곤 내부 칸만 좌석으로 남긴다. 좌석 번호는 각 행에서 좌→우로 1..k.
 */
export function generateSeats(section: Section, cfg: GridConfig): Seat[] {
  const detected = detectCorners(section.anchors);
  if (!detected) return axisGrid(section, cfg);

  const poly = polygonOf(section);
  const a = section.anchors;
  const chainsFor = (cs: number[]) => [
    chainBetween(a, cs[0], cs[1]),
    chainBetween(a, cs[1], cs[2]),
    chainBetween(a, cs[2], cs[3]),
    chainBetween(a, cs[3], cs[0]),
  ];
  // 변의 직선도 = 양끝 직선거리 / 호 길이 (1=직선, <1=곡선).
  const straightness = (pts: Point[]) => {
    const al = polylineLength(pts);
    if (al === 0) return 1;
    const chord = Math.hypot(
      pts[0].x - pts[pts.length - 1].x,
      pts[0].y - pts[pts.length - 1].y,
    );
    return chord / al;
  };

  let cs = detected as number[];
  let [s01, s12, s23, s30] = chainsFor(cs);
  // 행(top/bottom)은 더 휜 변쌍이 되도록 방향을 고른다.
  // (직선 변쌍을 좌우로 두면 Coons 가 깔끔한 호 룰드 보간으로 수렴해 환형/사선에서 잘림이 사라진다.)
  const strTopBottom = (straightness(s01) + straightness(s23)) / 2;
  const strLeftRight = (straightness(s12) + straightness(s30)) / 2;
  if (strTopBottom > strLeftRight) {
    cs = [cs[1], cs[2], cs[3], cs[0]];
    [s01, s12, s23, s30] = chainsFor(cs);
  }

  const sTop = arcSampler(s01);
  const sRight = arcSampler(s12);
  const sBottomRev = arcSampler(s23); // c2→c3
  const sLeftRev = arcSampler(s30); // c3→c0
  const topF = (u: number) => sTop(u);
  const rightF = (v: number) => sRight(v);
  const bottomF = (u: number) => sBottomRev(1 - u);
  const leftF = (v: number) => sLeftRev(1 - v);

  const P00 = topF(0),
    P10 = topF(1),
    P01 = bottomF(0),
    P11 = bottomF(1);
  // Coons 패치: 두 방향 선형 보간 합에서 모서리 이중보간을 뺀다.
  const coons = (u: number, v: number): Point => {
    const p = lerp(topF(u), bottomF(u), v);
    const q = lerp(leftF(v), rightF(v), u);
    const bx =
      (1 - u) * (1 - v) * P00.x +
      u * (1 - v) * P10.x +
      (1 - u) * v * P01.x +
      u * v * P11.x;
    const by =
      (1 - u) * (1 - v) * P00.y +
      u * (1 - v) * P10.y +
      (1 - u) * v * P01.y +
      u * v * P11.y;
    return { x: p.x + q.x - bx, y: p.y + q.y - by };
  };

  const colPitch = Math.max(MIN_PITCH, cfg.colPitch);
  const rowPitch = Math.max(MIN_PITCH, cfg.rowPitch);
  // 행 수는 좌우 변(행 진행 방향) 길이로 정한다.
  const height = (polylineLength(s12) + polylineLength(s30)) / 2;
  const rows = Math.min(MAX_LINES, Math.max(1, Math.round(height / rowPitch)));
  const ROW_SAMPLES = 48;

  const seats: Seat[] = [];
  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    // 해당 행의 곡선을 펴서 실제 길이만큼 좌석을 채운다(행마다 열 수 가변).
    const rowPts: Point[] = [];
    for (let k = 0; k <= ROW_SAMPLES; k++) rowPts.push(coons(k / ROW_SAMPLES, v));
    const rowLen = polylineLength(rowPts);
    const cols = Math.min(MAX_LINES, Math.max(1, Math.round(rowLen / colPitch)));
    const along = arcSampler(rowPts);
    let num = 0;
    for (let c = 0; c < cols; c++) {
      const p = along((c + 0.5) / cols);
      if (pointInPolygon(p, poly)) {
        num++;
        seats.push({ id: genId(), x: p.x, y: p.y, gridRow: r, number: num, available: true });
      }
    }
  }
  return seats;
}
