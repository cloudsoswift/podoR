import { sectionToPath } from "./geometry";
import { HandleSide, Section } from "./types";

interface Props {
  section: Section;
  selected: boolean;
  interactive: boolean;
  onSelect: (id: string) => void;
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
  interactive,
  onSelect,
  onAnchorPointerDown,
  onHandlePointerDown,
}: Props) {
  const d = sectionToPath(section);

  return (
    <g>
      <path
        d={d}
        fill={section.color}
        fillOpacity={selected ? 0.45 : 0.28}
        stroke={section.color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeLinejoin="round"
        style={{
          pointerEvents: interactive ? "auto" : "none",
          cursor: interactive ? "pointer" : "default",
        }}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onSelect(section.id);
        }}
      />

      {selected &&
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
                strokeWidth={1}
                strokeDasharray="3 3"
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
                strokeWidth={1}
                strokeDasharray="3 3"
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* 컨트롤 핸들 점 (사각형) */}
            {a.handleIn && (
              <rect
                x={a.handleIn.x - 4}
                y={a.handleIn.y - 4}
                width={8}
                height={8}
                fill="#fff"
                stroke={section.color}
                strokeWidth={1.5}
                style={{ cursor: "grab" }}
                onPointerDown={(e) =>
                  onHandlePointerDown(e, section.id, a.id, "in")
                }
              />
            )}
            {a.handleOut && (
              <rect
                x={a.handleOut.x - 4}
                y={a.handleOut.y - 4}
                width={8}
                height={8}
                fill="#fff"
                stroke={section.color}
                strokeWidth={1.5}
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
              r={6}
              fill={section.color}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => onAnchorPointerDown(e, section.id, a.id)}
            />
          </g>
        ))}
    </g>
  );
}
