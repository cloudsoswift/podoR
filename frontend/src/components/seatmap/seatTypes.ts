// 좌석 에디터 전용 타입.
// 섹션을 격자로 가득 채워 좌석을 만든 뒤, 사용하지 않을 좌석을 표시(available=false)한다.
// 저장 시에는 available 좌석만 내보낸다.

export interface Seat {
  id: string;
  x: number; // 콘텐츠 좌표(섹션과 동일한 1000×700 공간)
  y: number;
  gridRow: number; // 0-based 행 인덱스(위→아래). 행 정체성/압축 정렬용.
  number: number; // 같은 행 내 좌석 번호(생성 시 1..k). 미사용 좌석으로 결번이 생길 수 있다.
  available: boolean; // true=사용(저장 대상), false=사용 안 함
}

// 격자 생성 파라미터. 섹션 바운딩 박스를 간격(pitch)에 맞춰 가득 채운다.
export interface GridConfig {
  colPitch: number; // 같은 행 내 좌석 중심 간 가로 간격(px)
  rowPitch: number; // 행 간 세로 간격(px)
}

// pan=화면 이동, select=좌석 클릭/드래그로 사용·미사용 표시.
export type SeatTool = "pan" | "select";
