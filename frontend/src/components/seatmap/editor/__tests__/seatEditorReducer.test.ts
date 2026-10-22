import { createInitialState, seatEditorReducer } from "../seatEditorReducer";

test("좌석을 생성하면 그때의 간격을 seatGrid 로 기억한다", () => {
  let s = createInitialState();
  s = seatEditorReducer(s, { type: "SET_GRID", patch: { colPitch: 25, rowPitch: 30 } });
  expect(s.seatGrid).toBeNull();

  s = seatEditorReducer(s, { type: "GENERATE_GRID" });
  expect(s.seatGrid).toEqual({ colPitch: 25, rowPitch: 30 });

  // 툴바 값만 바꾸고 재생성하지 않으면 좌석의 간격은 그대로다.
  s = seatEditorReducer(s, { type: "SET_GRID", patch: { colPitch: 40 } });
  expect(s.seatGrid).toEqual({ colPitch: 25, rowPitch: 30 });

  s = seatEditorReducer(s, { type: "CLEAR_SEATS" });
  expect(s.seatGrid).toBeNull();
});
