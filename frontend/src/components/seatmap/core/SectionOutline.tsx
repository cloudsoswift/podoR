import { sectionToPath } from "./geometry";
import { Section } from "./types";

/** 좌석 맵의 섹션 경계 밑그림(연한 채움·외곽선, 포인터 무시). */
export default function SectionOutline({ section }: { section: Section }) {
  return (
    <path
      d={sectionToPath(section)}
      fill={section.color}
      fillOpacity={0.06}
      stroke={section.color}
      strokeOpacity={0.5}
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      style={{ pointerEvents: "none" }}
    />
  );
}
