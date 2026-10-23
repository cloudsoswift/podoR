import { newRow } from "../rowGeometry";
import { buildSeatmapPayload, parseSeatmapDoc } from "../seatmapApi";
import { Section } from "../types";

const sec = (id: string, name: string): Section => ({ id, name, color: "#000000", anchors: [] });

test("저장: 남아 있는 섹션의 줄만, layoutJson 을 다시 읽으면 같은 줄", () => {
  const rowsBySection = {
    s1: [{ ...newRow("r1", 2, { x: 10, y: 10 }), name: "A" }],
    gone: [{ ...newRow("r2", 2, { x: 10, y: 10 }), name: "Z" }],
  };
  const { layoutJson, seats } = buildSeatmapPayload([sec("s1", "A구역")], rowsBySection);
  expect(seats).toEqual([
    { section: "A구역", rowNumber: "A", seatNumber: 1, isAvailable: true },
    { section: "A구역", rowNumber: "A", seatNumber: 2, isAvailable: true },
  ]);
  const doc = parseSeatmapDoc(layoutJson);
  expect(doc.sections.map((s) => s.id)).toEqual(["s1"]);
  expect(doc.rowsBySection).toEqual({ s1: rowsBySection.s1 });
  expect(JSON.parse(layoutJson).version).toBe(1);
});

test("저장: 번호 없는 사용 안 함 좌석은 빼고, 번호 있는 사용 안 함 좌석은 isAvailable=false", () => {
  const skip = { ...newRow("k", 3, { x: 0, y: 0 }), name: "K", unavailable: [1], skipUnavailableNumbers: true };
  const keep = { ...newRow("p", 3, { x: 0, y: 50 }), name: "P", unavailable: [1] };
  const { seats } = buildSeatmapPayload([sec("s1", "A구역")], { s1: [skip, keep] });
  expect(seats.filter((s) => s.rowNumber === "K").map((s) => [s.seatNumber, s.isAvailable])).toEqual([
    [1, true],
    [2, true],
  ]);
  expect(seats.filter((s) => s.rowNumber === "P").map((s) => [s.seatNumber, s.isAvailable])).toEqual([
    [1, true],
    [2, false],
    [3, true],
  ]);
});

test("읽기: 배열·null·깨진 JSON 은 빈 값, rowsBySection 없으면 {}", () => {
  const empty = { sections: [], rowsBySection: {} };
  expect(parseSeatmapDoc(JSON.stringify([sec("s1", "A")]))).toEqual(empty);
  expect(parseSeatmapDoc(null)).toEqual(empty);
  expect(parseSeatmapDoc("{oops")).toEqual(empty);
  expect(parseSeatmapDoc(JSON.stringify({ version: 1, sections: [sec("s1", "A")] })).rowsBySection).toEqual({});
});

test("저장: 줄 이름의 앞뒤 공백은 빼고 보낸다", () => {
  const row = { ...newRow("r1", 1, { x: 0, y: 0 }), name: " A " };
  expect(buildSeatmapPayload([sec("s1", "A구역")], { s1: [row] }).seats[0].rowNumber).toBe("A");
});
