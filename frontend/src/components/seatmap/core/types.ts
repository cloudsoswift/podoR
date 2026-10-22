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

// 캔버스 상호작용 도구. pan=화면 이동, select=섹션 선택/이동, pen=점 찍기/편집.
export type Tool = "pan" | "select" | "pen";

export type HandleSide = "in" | "out";

// 배경 밑그림(설계도). 섹션 데이터가 아닌 작도 보조용 — JSON 으로 내보내지 않는다.
export interface BackgroundImage {
  src: string; // object URL 또는 data URL
  x: number; // 콘텐츠 좌표 기준 좌상단
  y: number;
  width: number;
  height: number;
  naturalWidth: number; // 원본 픽셀 크기(비율 유지 리사이즈/맞추기에 사용)
  naturalHeight: number;
  opacity: number; // 0~1
  locked: boolean; // true 면 backdrop(편집 불가), false 면 이동·리사이즈 가능
}

// 배경 리사이즈 핸들 위치.
export type BgCorner = "nw" | "ne" | "sw" | "se";
