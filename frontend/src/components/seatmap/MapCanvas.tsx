import { useId } from "react";
import { VIEW_H, VIEW_W } from "./editorReducer";
import { PanZoom } from "./usePanZoom";
import { viewTransform } from "./viewport";

interface Props {
  pz: PanZoom;
  cursor: string;
  svgProps?: Omit<
    React.SVGProps<SVGSVGElement>,
    "ref" | "viewBox" | "style" | "className"
  >;
  // 콘텐츠 좌표계(카메라 그룹) 안에 그려질 요소.
  children: React.ReactNode;
  // svg 위에 띄우는 absolute 오버레이(상태 패널 등).
  overlay?: React.ReactNode;
}

/** 좌석맵 공용 캔버스: 1000×700 종이 + 보조 그리드 + 팬/줌 카메라 + 줌 컨트롤. */
export default function MapCanvas({ pz, cursor, svgProps, children, overlay }: Props) {
  const gridId = useId();
  const { view, svgRef } = pz;
  const center = { x: VIEW_W / 2, y: VIEW_H / 2 };

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-full w-full touch-none select-none bg-white"
        style={{ cursor }}
        {...svgProps}
      >
        <defs>
          <pattern id={gridId} width={40} height={40} patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>

        <g transform={viewTransform(view)}>
          <rect
            x={0}
            y={0}
            width={VIEW_W}
            height={VIEW_H}
            fill={`url(#${gridId})`}
            stroke="#e2e8f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
          {children}
        </g>
      </svg>

      {overlay}

      {/* 줌 컨트롤 */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => pz.zoomBy(1 / 1.2, center)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="축소"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => pz.resetView()}
          className="min-w-[3rem] rounded-md px-1 text-center text-xs font-medium text-gray-600 hover:bg-gray-100"
          title="뷰 초기화"
        >
          {Math.round(view.z * 100)}%
        </button>
        <button
          type="button"
          onClick={() => pz.zoomBy(1.2, center)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="확대"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
