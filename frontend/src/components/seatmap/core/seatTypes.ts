import { Point } from "./types";

// ── 줄(row) 단위 좌석 모델 ──
// 줄만 저장하고 좌석 좌표·반지름·번호는 rowGeometry 의 순수 함수로 계산한다.

// forward = 첫 좌석(인덱스 0)부터, reverse = 끝 좌석부터 번호를 매긴다.
export type NumberDirection = "forward" | "reverse";

// row = 줄 선택·이동·편집, seat = 좌석 사용 여부 표시.
export type RowEditorMode = "row" | "seat";

export interface SeatRow {
  id: string;
  name: string; // 줄 이름. 새 줄은 ""
  seatCount: number; // ≥ 1
  center: Point; // 첫·끝 좌석 중심을 잇는 현의 중점(콘텐츠 좌표)
  rotation: number; // 도, SVG 기준 시계 방향
  spacing: number; // 이웃 좌석 사이 경로 길이(곡선이면 호 길이)
  seatRadius: number;
  arcAngle: number; // 도. 0 = 직선, 양수 = 로컬 −y(위)로 볼록
  startNumber: number;
  numberDirection: NumberDirection;
  skipUnavailableNumbers: boolean; // 사용 안 함 좌석은 번호를 받지 않음
  unavailable: number[]; // 사용 안 함 좌석 인덱스(0 = 첫 좌석)
}

// 줄에서 계산한 좌석 하나.
export interface RowSeat {
  rowId: string;
  index: number;
  x: number;
  y: number;
  r: number;
  available: boolean;
  number: number | null; // 건너뛰기 켬 + 사용 안 함이면 null
}
