import { Point } from "./types";

interface Props {
  draft: Point[];
  cursor: Point | null;
  canClose: boolean; // 첫 점을 다시 클릭하면 닫을 수 있는 상태인지
}

/** 그리는 중인 다각형 미리보기. 클릭 처리는 캔버스가 담당하므로 시각 전용(pointer-events none). */
export default function DraftLayer({ draft, cursor, canClose }: Props) {
  if (draft.length === 0) return null;

  const linePoints = draft.map((p) => `${p.x},${p.y}`).join(" ");
  const first = draft[0];
  const last = draft[draft.length - 1];

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* 확정된 변들 */}
      {draft.length > 1 && (
        <polyline
          points={linePoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
        />
      )}

      {/* 커서까지의 러버밴드 선 */}
      {cursor && (
        <line
          x1={last.x}
          y1={last.y}
          x2={cursor.x}
          y2={cursor.y}
          stroke="#a5b4fc"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}

      {/* 찍은 점들 */}
      {draft.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 && canClose ? 8 : 4}
          fill={i === 0 && canClose ? "#6366f1" : "#fff"}
          stroke="#6366f1"
          strokeWidth={2}
        />
      ))}

      {/* 닫기 가능 시 첫 점 강조 링 */}
      {canClose && (
        <circle
          cx={first.x}
          cy={first.y}
          r={12}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
    </g>
  );
}
