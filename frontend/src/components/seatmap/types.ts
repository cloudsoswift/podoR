export interface Point {
  x: number;
  y: number;
}

export interface Anchor {
  id: string;
  x: number;
  y: number;
  // 절대 SVG 좌표. null이면 해당 방향 세그먼트는 직선(핸들 없음).
  handleIn: Point | null;
  handleOut: Point | null;
}

export interface Section {
  id: string;
  name: string;
  color: string; // 채움/스트로크 색 (#rrggbb)
  // 닫힌 루프. 세그먼트는 anchor[i] -> anchor[(i+1) % n].
  anchors: Anchor[];
}

export type Mode = "draw" | "select";

export type HandleSide = "in" | "out";
