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

/** anchor 기준으로 handle 의 반대편 대칭점을 구한다(부드러운 곡선용). */
export function mirror(anchor: Point, handle: Point): Point {
  return {
    x: 2 * anchor.x - handle.x,
    y: 2 * anchor.y - handle.y,
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
