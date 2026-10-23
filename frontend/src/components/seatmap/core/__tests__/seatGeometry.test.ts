import { flattenSection } from "../seatGeometry";
import { Section } from "../types";

const a = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });

test("flattenSection: 곡선 없는 섹션은 앵커 꼭짓점 그대로", () => {
  const sec: Section = {
    id: "s",
    name: "S",
    color: "#000",
    anchors: [a("1", 0, 0), a("2", 100, 0), a("3", 100, 50)],
  };
  expect(flattenSection(sec)).toEqual([
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 0 },
  ]);
});
