import {
  MAX_ARC_ANGLE,
  rowChord,
  rowLocalCenters,
  rowToWorld,
} from "@/components/seatmap/core/rowGeometry";
import { clamp } from "@/components/seatmap/core/geometry";
import { SeatRow } from "@/components/seatmap/core/seatTypes";
import { Point } from "@/components/seatmap/core/types";

export interface RowHandlePositions {
  corners: Point[]; // 좌상·우상·우하·좌하(줄과 함께 회전)
  rotate: Point;
  bend: Point;
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** 월드(콘텐츠) 좌표 → 줄 로컬 좌표. */
function toLocal(row: SeatRow, p: Point): Point {
  const a = (-row.rotation * Math.PI) / 180;
  const dx = p.x - row.center.x;
  const dy = p.y - row.center.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

/** 좌석 원을 모두 감싸는 로컬 사각형(여백 = 좌석 반지름). */
function localBox(row: SeatRow) {
  const pts = rowLocalCenters(row);
  const pad = row.seatRadius;
  return {
    minX: Math.min(...pts.map((p) => p.x)) - pad,
    maxX: Math.max(...pts.map((p) => p.x)) + pad,
    minY: Math.min(...pts.map((p) => p.y)) - pad,
    maxY: Math.max(...pts.map((p) => p.y)) + pad,
  };
}

/** 핸들 위치(월드). 회전 핸들은 윗변 위로, 휨 핸들은 아랫변 아래로 화면상 일정 거리만큼 띄운다. */
export function rowHandlePositions(row: SeatRow, invZoom: number): RowHandlePositions {
  const b = localBox(row);
  const midX = (b.minX + b.maxX) / 2;
  return {
    corners: [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ].map((p) => rowToWorld(row, p)),
    rotate: rowToWorld(row, { x: midX, y: b.minY - 24 * invZoom }),
    bend: rowToWorld(row, { x: midX, y: b.maxY + 12 * invZoom }),
  };
}

/** 첫 좌석 표시 위치(로컬 왼쪽 끝 바깥). */
export function firstSeatMarker(row: SeatRow, invZoom: number): Point {
  const b = localBox(row);
  const first = rowLocalCenters(row)[0];
  return rowToWorld(row, { x: b.minX - 6 * invZoom, y: first.y });
}

/** 크기 핸들: 중심에서의 거리 비(중심 고정). */
export function scaleFactorFromDrag(row: SeatRow, start: Point, current: Point): number {
  const d0 = Math.hypot(start.x - row.center.x, start.y - row.center.y);
  if (d0 === 0) return 1;
  return Math.hypot(current.x - row.center.x, current.y - row.center.y) / d0;
}

/** 회전 핸들: 중심에서 본 방향. 바로 위 = 0, 오른쪽 = 90. */
export function rotationFromPoint(row: SeatRow, p: Point): number {
  return toDeg(Math.atan2(p.x - row.center.x, -(p.y - row.center.y)));
}

/**
 * 휨 핸들: 드래그 시작 시점의 줄 기준으로, 로컬 위쪽으로 끈 만큼 호의 높이(현 중점에서 호까지, h)를 더한다.
 * θ = 4·atan(2h/c). 잡는 순간 휨이 튀지 않도록 절대 위치가 아니라 이동량을 쓴다.
 */
export function arcFromDrag(startRow: SeatRow, start: Point, current: Point): number {
  const c = rowChord(startRow);
  if (startRow.seatCount <= 1 || c === 0) return 0;
  const theta0 = (Math.abs(startRow.arcAngle) * Math.PI) / 180;
  const h0 = Math.sign(startRow.arcAngle) * (c / 2) * Math.tan(theta0 / 4);
  const dy = toLocal(startRow, current).y - toLocal(startRow, start).y;
  const h = h0 - dy;
  return clamp(toDeg(4 * Math.atan((2 * h) / c)), -MAX_ARC_ANGLE, MAX_ARC_ANGLE);
}
