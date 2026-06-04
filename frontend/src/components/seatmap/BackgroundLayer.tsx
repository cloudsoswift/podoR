import { BackgroundImage, BgCorner } from "./types";

interface Props {
  background: BackgroundImage;
  // 편집 가능 여부(잠금 해제 상태). false 면 backdrop 으로만 렌더(pointer-events none).
  editable: boolean;
  scale: number; // 줌 역수(1/z). 프레임·핸들을 화면상 일정 크기로 유지.
  onBodyPointerDown: (e: React.PointerEvent) => void;
  onHandlePointerDown: (e: React.PointerEvent, corner: BgCorner) => void;
}

const CORNERS: { corner: BgCorner; cursor: string }[] = [
  { corner: "nw", cursor: "nwse-resize" },
  { corner: "ne", cursor: "nesw-resize" },
  { corner: "sw", cursor: "nesw-resize" },
  { corner: "se", cursor: "nwse-resize" },
];

function cornerPoint(bg: BackgroundImage, corner: BgCorner) {
  const x = corner === "nw" || corner === "sw" ? bg.x : bg.x + bg.width;
  const y = corner === "nw" || corner === "ne" ? bg.y : bg.y + bg.height;
  return { x, y };
}

/** 배경 밑그림. 편집 모드에서는 이동/리사이즈용 프레임과 코너 핸들을 함께 보여준다. */
export default function BackgroundLayer({
  background: bg,
  editable,
  scale,
  onBodyPointerDown,
  onHandlePointerDown,
}: Props) {
  const s = scale;

  return (
    <g>
      <image
        href={bg.src}
        x={bg.x}
        y={bg.y}
        width={bg.width}
        height={bg.height}
        opacity={bg.opacity}
        preserveAspectRatio="none"
        style={{
          pointerEvents: editable ? "auto" : "none",
          cursor: editable ? "move" : "default",
        }}
        onPointerDown={editable ? onBodyPointerDown : undefined}
      />

      {editable && (
        <>
          {/* 편집 프레임 */}
          <rect
            x={bg.x}
            y={bg.y}
            width={bg.width}
            height={bg.height}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1.5 * s}
            strokeDasharray={`${5 * s} ${4 * s}`}
            style={{ pointerEvents: "none" }}
          />

          {/* 코너 리사이즈 핸들 */}
          {CORNERS.map(({ corner, cursor }) => {
            const p = cornerPoint(bg, corner);
            return (
              <rect
                key={corner}
                x={p.x - 5 * s}
                y={p.y - 5 * s}
                width={10 * s}
                height={10 * s}
                fill="#fff"
                stroke="#6366f1"
                strokeWidth={1.5 * s}
                style={{ cursor }}
                onPointerDown={(e) => onHandlePointerDown(e, corner)}
              />
            );
          })}
        </>
      )}
    </g>
  );
}
