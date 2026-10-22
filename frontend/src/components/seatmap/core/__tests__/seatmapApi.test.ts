import { buildSeatmapPayload, parseSeatmapDoc } from "../seatmapApi";
import { Section } from "../types";

const section: Section = { id: "s1", name: "A구역", color: "#000000", anchors: [] };

test("좌석 간격(gridBySection)이 layoutJson 에 저장되고 다시 읽힌다", () => {
  const grid = { colPitch: 25, rowPitch: 30 };
  const { layoutJson } = buildSeatmapPayload([section], { s1: [] }, { s1: grid });
  expect(parseSeatmapDoc(layoutJson).gridBySection).toEqual({ s1: grid });
});

test("간격이 없는 이전 문서는 빈 gridBySection 으로 읽힌다", () => {
  const old = JSON.stringify({ version: 1, sections: [section], seatsBySection: { s1: [] } });
  expect(parseSeatmapDoc(old).gridBySection).toEqual({});
  expect(parseSeatmapDoc(null).gridBySection).toEqual({});
});
