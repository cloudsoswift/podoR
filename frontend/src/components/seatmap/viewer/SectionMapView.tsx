"use client";

import MapCanvas from "@/components/seatmap/core/MapCanvas";
import SectionShape from "@/components/seatmap/core/SectionShape";
import { usePanZoom } from "@/components/seatmap/core/usePanZoom";
import { Section } from "@/components/seatmap/core/types";
import { useClickOrPan } from "@/components/seatmap/core/useClickOrPan";

interface Props {
  sections: Section[];
  // 섹션 이름 → 좌석 집계.
  stats: Map<string, { total: number; available: number }>;
  onSelect(sectionName: string): void;
}

/** 1단계: 에디터에서 배치한 섹션 도형 그대로의 섹션 맵 + 우측 상단 섹션 목록. */
export default function SectionMapView({ sections, stats, onSelect }: Props) {
  const pz = usePanZoom();
  const { svgProps, guardClick } = useClickOrPan(pz);

  const statOf = (name: string) => stats.get(name) ?? { total: 0, available: 0 };
  // 매진이거나 판매 좌석이 없는 섹션은 흐리게(진입은 가능).
  const isDimmed = (name: string) => statOf(name).available === 0;

  const panel = (
    <div className="absolute right-3 top-3 max-h-[calc(100%-1.5rem)] w-44 overflow-y-auto rounded-lg border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      {sections.map((sec) => {
        const st = statOf(sec.name);
        const dimmed = isDimmed(sec.name);
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => onSelect(sec.name)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
          >
            <span
              className="truncate font-medium"
              style={{ color: dimmed ? "#9ca3af" : sec.color }}
            >
              {sec.name}
            </span>
            <span className={`shrink-0 text-xs ${dimmed ? "text-gray-400" : "text-gray-500"}`}>
              잔여 {st.available}/{st.total}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <MapCanvas
      pz={pz}
      cursor={pz.panning ? "grabbing" : "grab"}
      svgProps={svgProps}
      overlay={panel}
    >
      {sections.map((sec) => (
        <SectionShape
          key={sec.id}
          section={sec}
          selected={false}
          bodyInteractive
          editable={false}
          scale={1 / pz.view.z}
          bodyCursor="pointer"
          dimmed={isDimmed(sec.name)}
          onSectionClick={guardClick(() => onSelect(sec.name))}
        />
      ))}
    </MapCanvas>
  );
}
