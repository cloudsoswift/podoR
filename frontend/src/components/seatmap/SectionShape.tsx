import { sectionToPath } from "./geometry";
import { HandleSide, Section } from "./types";

interface Props {
  section: Section;
  selected: boolean;
  // 도형 바디가 포인터를 받는지(선택/이동/펜-선택).
  bodyInteractive: boolean;
  // 앵커·핸들을 표시하고 편집할 수 있는지(펜 도구로 선택된 섹션).
  editable: boolean;
  // 줌 역수(1/z). 앵커·핸들·선 두께를 화면상 일정 크기로 유지하는 데 곱한다.
  scale: number;
  bodyCursor: string;
  onSectionPointerDown: (e: React.PointerEvent, sectionId: string) => void;
  onAnchorPointerDown: (
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
  ) => void;
  onHandlePointerDown: (
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
    side: HandleSide,
  ) => void;
}

export default function SectionShape({
  section,
  selected,
  bodyInteractive,
  editable,
  scale,
  bodyCursor,
  onSectionPointerDown,
  onAnchorPointerDown,
  onHandlePointerDown,
}: Props) {
  const d = sectionToPath(section);
  const s = scale;

  return (
    <g>
      <path
        d={d}
        fill={section.color}
        fillOpacity={selected ? 0.45 : 0.28}
        stroke={section.color}
        strokeWidth={(selected ? 2.5 : 1.5) * s}
        strokeLinejoin="round"
        style={{
          pointerEvents: bodyInteractive ? "auto" : "none",
          cursor: bodyInteractive ? bodyCursor : "default",
        }}
        onPointerDown={(e) => onSectionPointerDown(e, section.id)}
      />

      {editable &&
        section.anchors.map((a) => (
          <g key={a.id}>
            {/* 컨트롤 핸들 가이드 라인 */}
            {a.handleIn && (
              <line
                x1={a.x}
                y1={a.y}
                x2={a.handleIn.x}
                y2={a.handleIn.y}
                stroke="#94a3b8"
                strokeWidth={1 * s}
                strokeDasharray={`${3 * s} ${3 * s}`}
                style={{ pointerEvents: "none" }}
              />
            )}
            {a.handleOut && (
              <line
                x1={a.x}
                y1={a.y}
                x2={a.handleOut.x}
                y2={a.handleOut.y}
                stroke="#94a3b8"
                strokeWidth={1 * s}
                strokeDasharray={`${3 * s} ${3 * s}`}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* 컨트롤 핸들 점 (사각형) */}
            {a.handleIn && (
              <rect
                x={a.handleIn.x - 4 * s}
                y={a.handleIn.y - 4 * s}
                width={8 * s}
                height={8 * s}
                fill="#fff"
                stroke={section.color}
                strokeWidth={1.5 * s}
                style={{ cursor: "grab" }}
                onPointerDown={(e) =>
                  onHandlePointerDown(e, section.id, a.id, "in")
                }
              />
            )}
            {a.handleOut && (
              <rect
                x={a.handleOut.x - 4 * s}
                y={a.handleOut.y - 4 * s}
                width={8 * s}
                height={8 * s}
                fill="#fff"
                stroke={section.color}
                strokeWidth={1.5 * s}
                style={{ cursor: "grab" }}
                onPointerDown={(e) =>
                  onHandlePointerDown(e, section.id, a.id, "out")
                }
              />
            )}

            {/* 앵커 점 (원) */}
            <circle
              cx={a.x}
              cy={a.y}
              r={6 * s}
              fill={section.color}
              stroke="#fff"
              strokeWidth={2 * s}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => onAnchorPointerDown(e, section.id, a.id)}
            />
          </g>
        ))}
    </g>
  );
}
