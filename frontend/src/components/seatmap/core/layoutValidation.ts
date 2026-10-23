import { rowSeats, seatKey } from "./rowGeometry";
import { RowSeat, SeatRow } from "./seatTypes";
import { flattenSection, pointInPolygon } from "./seatGeometry";
import { Point, Section } from "./types";

// 맞닿음을 겹침으로 보지 않기 위한 허용 오차(콘텐츠 단위).
export const OVERLAP_EPS = 0.01;
// 줄 이름 최대 길이(백엔드 Seat.row_number 컬럼 길이).
export const MAX_ROW_NAME_LENGTH = 10;

/** 점에서 선분까지의 거리. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToBoundary(p: Point, poly: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return best;
}

/** 경계에서 OVERLAP_EPS 보다 안쪽에 있는지(경계 위 점은 안으로 치지 않는다). */
function strictlyInside(p: Point, poly: Point[]): boolean {
  return pointInPolygon(p, poly) && distToBoundary(p, poly) > OVERLAP_EPS;
}

/** 서로 원이 겹치는 좌석의 seatKey. 이웃 격자 칸끼리만 비교한다. */
export function findSeatOverlaps(seats: RowSeat[]): Set<string> {
  const out = new Set<string>();
  if (seats.length < 2) return out;
  const cell = Math.max(...seats.map((s) => s.r)) * 2 || 1;
  // 칸마다 좌석 인덱스 목록.
  const grid = new Map<string, number[]>();
  const cellOf = (v: number) => Math.floor(v / cell);
  seats.forEach((s, i) => {
    const k = `${cellOf(s.x)},${cellOf(s.y)}`;
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  seats.forEach((s, i) => {
    const cx = cellOf(s.x);
    const cy = cellOf(s.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const j of grid.get(`${gx},${gy}`) ?? []) {
          if (j <= i) continue; // 각 쌍은 한 번만
          const o = seats[j];
          if (Math.hypot(s.x - o.x, s.y - o.y) < s.r + o.r - OVERLAP_EPS) {
            out.add(seatKey(s.rowId, s.index));
            out.add(seatKey(o.rowId, o.index));
          }
        }
      }
    }
  });
  return out;
}

/** 원이 섹션 경계를 넘는(또는 중심이 밖인) 좌석의 seatKey. */
export function findSeatsOutside(section: Section, seats: RowSeat[]): Set<string> {
  const poly = flattenSection(section);
  const out = new Set<string>();
  for (const s of seats) {
    const p = { x: s.x, y: s.y };
    if (!pointInPolygon(p, poly) || distToBoundary(p, poly) < s.r - OVERLAP_EPS) {
      out.add(seatKey(s.rowId, s.index));
    }
  }
  return out;
}

/** 섹션 안에서 (줄 이름, 좌석 번호)가 겹치는 좌석의 seatKey. 이름 없는 줄·번호 없는 좌석은 제외. */
export function findDuplicateSeatNumbers(rows: SeatRow[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    for (const s of rowSeats(row)) {
      if (s.number === null) continue;
      const k = `${name}|${s.number}`;
      byKey.set(k, [...(byKey.get(k) ?? []), seatKey(s.rowId, s.index)]);
    }
  }
  const out = new Set<string>();
  for (const keys of byKey.values()) if (keys.length > 1) keys.forEach((k) => out.add(k));
  return out;
}

export function findUnnamedRows(rows: SeatRow[]): Set<string> {
  return new Set(rows.filter((r) => r.name.trim() === "").map((r) => r.id));
}

/** 두 선분이 끝점·공선 접촉이 아닌 진짜 교차를 하는지. */
function properlyIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function centroid(poly: Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    area += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (area === 0) return poly[0] ?? { x: 0, y: 0 };
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

function polygonsOverlap(p: Point[], q: Point[]): boolean {
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      if (properlyIntersect(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
    }
  }
  if (p.some((v) => strictlyInside(v, q)) || q.some((v) => strictlyInside(v, p))) return true;
  // 변이 같은 직선 위에 겹쳐 놓인 경우: 꼭짓점에서 도형 안쪽으로 살짝 들어간 점이 상대 안에 있는지.
  if (p.some((_, i) => strictlyInside(insetCorner(p, i), q))) return true;
  // 완전히 같은 도형 등: 한쪽의 내부 점이 다른 쪽 안에 있는지.
  const c = centroid(p);
  return strictlyInside(c, p) && strictlyInside(c, q);
}

// 꼭짓점 안쪽 점을 찍는 거리. 경계 판정 오차(OVERLAP_EPS)보다 충분히 커야 한다.
const INSET = 0.1;

/** i 번째 꼭짓점에서 내각 이등분선을 따라 도형 안쪽으로 INSET 만큼 들어간 점. */
function insetCorner(poly: Point[], i: number): Point {
  const v = poly[i];
  const a = poly[(i - 1 + poly.length) % poly.length];
  const b = poly[(i + 1) % poly.length];
  const unit = (x: number, y: number) => {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  };
  const u1 = unit(a.x - v.x, a.y - v.y);
  const u2 = unit(b.x - v.x, b.y - v.y);
  // 두 변이 일직선이면 이등분선 대신 변의 법선.
  let d = unit(u1.x + u2.x, u1.y + u2.y);
  if (Math.hypot(u1.x + u2.x, u1.y + u2.y) < 1e-9) d = { x: -u1.y, y: u1.x };
  const p1 = { x: v.x + d.x * INSET, y: v.y + d.y * INSET };
  // 오목한 꼭짓점이면 반대쪽이 안쪽이다.
  return pointInPolygon(p1, poly) ? p1 : { x: v.x - d.x * INSET, y: v.y - d.y * INSET };
}

/** 다른 섹션과 겹치는 섹션의 id. 변을 공유하기만 하면 겹침이 아니다. */
export function findSectionOverlaps(sections: Section[]): Set<string> {
  const polys = sections.map(flattenSection);
  const out = new Set<string>();
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (polys[i].length < 3 || polys[j].length < 3) continue;
      if (polygonsOverlap(polys[i], polys[j]) || polygonsOverlap(polys[j], polys[i])) {
        out.add(sections[i].id);
        out.add(sections[j].id);
      }
    }
  }
  return out;
}

/** 저장을 막는 사유. 없으면 []. 삭제된 섹션(sections 에 없는 id)의 줄은 무시한다. */
export function validateLayout(sections: Section[], rowsBySection: Record<string, SeatRow[]>): string[] {
  const out: string[] = [];
  for (const sec of sections) {
    const rows = rowsBySection[sec.id] ?? [];
    const seats = rows.flatMap(rowSeats);
    const unnamed = findUnnamedRows(rows).size;
    const tooLong = rows.filter((r) => r.name.trim().length > MAX_ROW_NAME_LENGTH).length;
    const duplicates = findDuplicateSeatNumbers(rows).size;
    const overlaps = findSeatOverlaps(seats).size;
    const outside = findSeatsOutside(sec, seats).size;
    if (unnamed) out.push(`${sec.name}: 이름 없는 줄 ${unnamed}개`);
    if (tooLong) out.push(`${sec.name}: 줄 이름이 ${MAX_ROW_NAME_LENGTH}자를 넘는 줄 ${tooLong}개`);
    if (duplicates) out.push(`${sec.name}: 줄 이름·번호 중복 ${duplicates}석`);
    if (overlaps) out.push(`${sec.name}: 겹친 좌석 ${overlaps}석`);
    if (outside) out.push(`${sec.name}: 섹션 밖 좌석 ${outside}석`);
  }
  const overlapping = findSectionOverlaps(sections);
  if (overlapping.size) {
    out.push(`겹친 섹션: ${sections.filter((s) => overlapping.has(s.id)).map((s) => s.name).join(", ")}`);
  }
  return out;
}
