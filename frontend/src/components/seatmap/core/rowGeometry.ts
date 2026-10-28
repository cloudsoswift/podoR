import { clamp } from "./geometry";
import { RowSeat, SeatRow } from "./seatTypes";
import { Point } from "./types";

// 새 줄의 기본 간격과 좌석 반지름(0.4 × 간격).
export const DEFAULT_SPACING = 20;
export const DEFAULT_SEAT_RADIUS = 8;
// 확대·축소로 정할 수 있는 좌석 반지름 범위(0.4 × 간격 6 ~ 60).
export const MIN_SEAT_RADIUS = 2.4;
export const MAX_SEAT_RADIUS = 24;
// 휨(중심각) 한계(도). 180 = 반원.
export const MAX_ARC_ANGLE = 180;

// 이보다 작은 중심각(라디안)은 직선으로 본다(반지름 발산 방지).
const STRAIGHT_EPS = 1e-6;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function newRow(id: string, seatCount: number, center: Point): SeatRow {
  return {
    id,
    name: "",
    seatCount: Math.max(1, Math.round(seatCount)),
    center,
    rotation: 0,
    spacing: DEFAULT_SPACING,
    seatRadius: DEFAULT_SEAT_RADIUS,
    arcAngle: 0,
    startNumber: 1,
    numberDirection: "forward",
    skipUnavailableNumbers: false,
    unavailable: [],
  };
}

export function seatKey(rowId: string, index: number): string {
  return `${rowId}#${index}`;
}

function rotate(p: Point, deg: number): Point {
  const a = toRad(deg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/**
 * 줄 로컬 좌표의 좌석 중심(인덱스 순). 현이 x 축 위에 원점 중심으로 놓이고
 * 첫 좌석이 왼쪽 끝이다. 곡선이면 같은 호 길이 간격으로 원의 호 위에 놓인다.
 */
export function rowLocalCenters(row: SeatRow): Point[] {
  const n = row.seatCount;
  if (n <= 1) return [{ x: 0, y: 0 }];
  const theta = Math.abs(toRad(row.arcAngle));
  if (theta < STRAIGHT_EPS) {
    const c = row.spacing * (n - 1);
    return Array.from({ length: n }, (_, i) => ({ x: -c / 2 + i * row.spacing, y: 0 }));
  }
  const R = (row.spacing * (n - 1)) / theta;
  const sign = Math.sign(row.arcAngle);
  const base = R * Math.cos(theta / 2);
  return Array.from({ length: n }, (_, i) => {
    const phi = -theta / 2 + (i * theta) / (n - 1);
    return { x: R * Math.sin(phi), y: -sign * (R * Math.cos(phi) - base) };
  });
}

/** 줄 로컬 좌표 → 월드(콘텐츠) 좌표. */
export function rowToWorld(row: SeatRow, p: Point): Point {
  const q = rotate(p, row.rotation);
  return { x: row.center.x + q.x, y: row.center.y + q.y };
}

/** 첫·끝 좌석 중심 사이 직선 거리(현). */
export function rowChord(row: SeatRow): number {
  const n = row.seatCount;
  if (n <= 1) return 0;
  const theta = Math.abs(toRad(row.arcAngle));
  if (theta < STRAIGHT_EPS) return row.spacing * (n - 1);
  const R = (row.spacing * (n - 1)) / theta;
  return 2 * R * Math.sin(theta / 2);
}

/** 줄의 좌석(인덱스 오름차순 = 첫 좌석→끝 좌석). 번호는 방향·시작 번호·건너뛰기를 따른다. */
export function rowSeats(row: SeatRow): RowSeat[] {
  const unavailable = new Set(row.unavailable);
  const numbers: (number | null)[] = new Array(row.seatCount).fill(null);
  const order = Array.from({ length: row.seatCount }, (_, i) => i);
  if (row.numberDirection === "reverse") order.reverse();
  let next = row.startNumber;
  for (const i of order) {
    if (row.skipUnavailableNumbers && unavailable.has(i)) continue;
    numbers[i] = next++;
  }
  return rowLocalCenters(row).map((p, index) => {
    const w = rowToWorld(row, p);
    return {
      rowId: row.id,
      index,
      x: w.x,
      y: w.y,
      r: row.seatRadius,
      available: !unavailable.has(index),
      number: numbers[index],
    };
  });
}

/** ids 의 줄을 (dx, dy) 만큼 이동. ids 가 null 이면 전부. */
export function translateRows(
  rows: SeatRow[],
  ids: ReadonlySet<string> | null,
  dx: number,
  dy: number,
): SeatRow[] {
  return rows.map((r) =>
    ids && !ids.has(r.id)
      ? r
      : { ...r, center: { x: r.center.x + dx, y: r.center.y + dy } },
  );
}

/** 비율 고정 확대·축소. 반지름을 한계로 고정한 실제 배율을 간격에도 곱한다. */
export function scaleRow(row: SeatRow, factor: number): SeatRow {
  const r = clamp(row.seatRadius * factor, MIN_SEAT_RADIUS, MAX_SEAT_RADIUS);
  const k = r / row.seatRadius;
  return { ...row, seatRadius: r, spacing: row.spacing * k };
}

/** 휨 각도 변경. 현(폭)·중심·좌석 크기는 유지하고 호 위 간격을 다시 계산한다. */
export function setRowArc(row: SeatRow, arcAngle: number): SeatRow {
  const n = row.seatCount;
  if (n <= 1) return { ...row, arcAngle: 0 };
  const deg = clamp(arcAngle, -MAX_ARC_ANGLE, MAX_ARC_ANGLE);
  const c = rowChord(row);
  const theta = Math.abs(toRad(deg));
  const arcLength = theta < STRAIGHT_EPS ? c : (c * theta) / (2 * Math.sin(theta / 2));
  return { ...row, arcAngle: deg, spacing: arcLength / (n - 1) };
}

/**
 * 좌석 수 변경. 끝 좌석 쪽에서 추가·삭제하고 첫 좌석 위치·간격·좌석 크기는 유지한다.
 * 곡선 줄은 같은 원을 따라 이어 붙이거나 잘라낸다(중심각이 (n−1)/(N−1) 배).
 */
export function setRowSeatCount(row: SeatRow, seatCount: number): SeatRow {
  const n = Math.max(1, Math.round(seatCount));
  if (n === row.seatCount) return row;
  const first = rowToWorld(row, rowLocalCenters(row)[0]);
  const arcAngle =
    row.seatCount <= 1 || n <= 1
      ? 0
      : clamp((row.arcAngle * (n - 1)) / (row.seatCount - 1), -MAX_ARC_ANGLE, MAX_ARC_ANGLE);
  const next: SeatRow = {
    ...row,
    seatCount: n,
    arcAngle,
    unavailable: row.unavailable.filter((i) => i < n),
  };
  const localFirst = rotate(rowLocalCenters(next)[0], next.rotation);
  return { ...next, center: { x: first.x - localFirst.x, y: first.y - localFirst.y } };
}
