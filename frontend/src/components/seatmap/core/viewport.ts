import { clamp } from "./geometry";
import { Bounds } from "./seatGeometry";
import { Point } from "./types";

/** 콘텐츠 그룹에 적용되는 카메라: translate(tx,ty) 후 scale(z). */
export interface View {
  tx: number;
  ty: number;
  z: number;
}

// 콘텐츠 좌표 공간(섹션·좌석 좌표가 사는 1000×700).
export const VIEW_W = 1000;
export const VIEW_H = 700;

export const MIN_Z = 0.2;
export const MAX_Z = 8;
export const INITIAL_VIEW: View = { tx: 0, ty: 0, z: 1 };
// 클릭/드래그를 구분하는 이동 임계값(화면 px).
export const CLICK_SLOP = 4;

/** root(viewBox 좌표)를 고정점으로 factor 배 줌. 변화가 없으면 v 그대로. */
export function zoomAround(v: View, factor: number, root: Point): View {
  const newZ = clamp(v.z * factor, MIN_Z, MAX_Z);
  const k = newZ / v.z;
  if (k === 1) return v;
  return {
    z: newZ,
    tx: root.x - (root.x - v.tx) * k,
    ty: root.y - (root.y - v.ty) * k,
  };
}

/** 바운딩 박스를 화면(VIEW_W×VIEW_H)에 pad 여백을 두고 꽉 차게 맞춘 뷰. */
export function fitView(b: Bounds, pad = 40): View {
  const bw = b.maxX - b.minX || 1;
  const bh = b.maxY - b.minY || 1;
  const z = clamp(
    Math.min((VIEW_W - 2 * pad) / bw, (VIEW_H - 2 * pad) / bh),
    MIN_Z,
    MAX_Z,
  );
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { z, tx: VIEW_W / 2 - cx * z, ty: VIEW_H / 2 - cy * z };
}

export function viewTransform(v: View): string {
  return `translate(${v.tx} ${v.ty}) scale(${v.z})`;
}

/** 현재 화면 중앙의 콘텐츠 좌표. */
export function viewCenter(v: View): Point {
  return { x: (VIEW_W / 2 - v.tx) / v.z, y: (VIEW_H / 2 - v.ty) / v.z };
}

// 손가락으로 누를 수 있는 최소 좌석 지름(화면 px).
export const MIN_SEAT_DIAMETER_PX = 24;

/**
 * 가장 작은 좌석의 화면상 지름(2·minSeatRadius·pxPerUnit·z)이 minDiameterPx 보다 작으면
 * anchor(루트 좌표)를 고정점으로 그만큼 확대한다. pxPerUnit 은 줌 1 에서 콘텐츠 1단위의 화면 px(모르면 0).
 */
export function ensureMinSeatSize(
  v: View,
  minSeatRadius: number,
  pxPerUnit: number,
  anchor: Point,
  minDiameterPx = MIN_SEAT_DIAMETER_PX,
): View {
  if (pxPerUnit <= 0 || minSeatRadius <= 0) return v;
  const diameter = 2 * minSeatRadius * pxPerUnit * v.z;
  if (diameter >= minDiameterPx) return v;
  return zoomAround(v, minDiameterPx / diameter, anchor);
}
