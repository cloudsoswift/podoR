import { Anchor, Point, Section } from "./types";

/** 고유 id 생성. crypto.randomUUID 가용 시 사용, 아니면 폴백. */
export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Shift 각도 고정: prev 를 원점으로 cur 을 가장 가까운 직각 축(수평/수직)에 투영한다.
 * |dx| >= |dy| 면 수평(0°/180°), 아니면 수직(90°/270°)으로 스냅한다.
 * 축 방향 거리는 보존되므로 멀어지거나 가까워지는 것만 가능하다.
 */
export function snapToRightAngle(prev: Point, cur: Point): Point {
  const dx = cur.x - prev.x;
  const dy = cur.y - prev.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: cur.x, y: prev.y };
  }
  return { x: prev.x, y: cur.y };
}

/**
 * 드래그 중인 앵커를 양 이웃(prev/next)과 축 정렬 직각 코너를 이루는 위치로 스냅한다.
 * 한 이웃을 지나는 세로선(x 고정)과 다른 이웃을 지나는 가로선(y 고정)의 교점으로,
 * 두 변이 각각 수직·수평이 되어 꼭짓점에서 직각을 이룬다.
 * 두 조합 (prev.x, next.y) / (next.x, prev.y) 중 cursor 에 더 가까운 쪽을 택해
 * 드래그 방향의 코너로 자연스럽게 맞춘다.
 */
export function snapCornerRightAngle(
  prev: Point,
  next: Point,
  cursor: Point,
): Point {
  const a = { x: prev.x, y: next.y };
  const b = { x: next.x, y: prev.y };
  return dist(a, cursor) <= dist(b, cursor) ? a : b;
}

/**
 * 자연 크기(nw×nh)를 박스(bw×bh) 안에 비율 유지로 맞추고(contain) 중앙 정렬한 사각형.
 * 배경 이미지를 공연장 해상도에 자동으로 맞출 때 사용한다.
 */
export function fitContain(
  nw: number,
  nh: number,
  bw: number,
  bh: number,
): { x: number; y: number; width: number; height: number } {
  if (nw <= 0 || nh <= 0) return { x: 0, y: 0, width: bw, height: bh };
  const scale = Math.min(bw / nw, bh / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { x: (bw - width) / 2, y: (bh - height) / 2, width, height };
}

/**
 * 코너 앵커를 부드러운 곡선 앵커로 바꿀 때 쓸 양쪽 핸들을 추정한다.
 * 이웃 앵커(prev/next)를 잇는 방향을 접선으로 삼고, 각 변 길이의 1/3 만큼 뻗는다.
 */
export function autoHandles(
  prev: Point,
  anchor: Point,
  next: Point,
): { handleIn: Point; handleOut: Point } {
  const dir = { x: next.x - prev.x, y: next.y - prev.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const inLen = dist(anchor, prev) / 3;
  const outLen = dist(anchor, next) / 3;
  return {
    handleIn: { x: anchor.x - ux * inLen, y: anchor.y - uy * inLen },
    handleOut: { x: anchor.x + ux * outLen, y: anchor.y + uy * outLen },
  };
}

/**
 * Section 을 SVG path d 문자열로 변환한다.
 * 세그먼트 anchor[i] -> anchor[i+1] 은 둘 중 한쪽이라도 핸들이 있으면 3차 베지에(C),
 * 양쪽 다 없으면 직선(L). 한쪽만 있으면 없는 쪽 컨트롤 점은 앵커 좌표를 사용한다.
 * 루프는 항상 닫힌다(Z).
 */
export function sectionToPath(section: Section): string {
  const a = section.anchors;
  if (a.length === 0) return "";
  if (a.length === 1) return `M ${a[0].x} ${a[0].y}`;

  let d = `M ${a[0].x} ${a[0].y}`;
  for (let i = 0; i < a.length; i++) {
    const cur = a[i];
    const next = a[(i + 1) % a.length];
    if (cur.handleOut || next.handleIn) {
      const c1 = cur.handleOut ?? { x: cur.x, y: cur.y };
      const c2 = next.handleIn ?? { x: next.x, y: next.y };
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${next.x} ${next.y}`;
    } else {
      d += ` L ${next.x} ${next.y}`;
    }
  }
  return `${d} Z`;
}

/** draft 점 목록을 핸들 없는(직선 다각형) 앵커 배열로 변환. */
export function pointsToAnchors(points: Point[]): Anchor[] {
  return points.map((p) => ({
    id: genId(),
    x: p.x,
    y: p.y,
    handleIn: null,
    handleOut: null,
  }));
}

/** 임포트된 데이터가 Section[] 형태인지 검증한다. */
export function isValidSections(data: unknown): data is Section[] {
  if (!Array.isArray(data)) return false;
  return data.every((s) => {
    if (typeof s !== "object" || s === null) return false;
    const sec = s as Record<string, unknown>;
    if (typeof sec.id !== "string") return false;
    if (typeof sec.name !== "string") return false;
    if (typeof sec.color !== "string") return false;
    if (!Array.isArray(sec.anchors)) return false;
    return sec.anchors.every((an) => {
      if (typeof an !== "object" || an === null) return false;
      const anc = an as Record<string, unknown>;
      return (
        typeof anc.id === "string" &&
        typeof anc.x === "number" &&
        typeof anc.y === "number" &&
        isPointOrNull(anc.handleIn) &&
        isPointOrNull(anc.handleOut)
      );
    });
  });
}

function isPointOrNull(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === "number" && typeof p.y === "number";
}
