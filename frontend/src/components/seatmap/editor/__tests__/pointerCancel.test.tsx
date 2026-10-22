import { fireEvent, render } from "@testing-library/react";
import EditorCanvas from "../EditorCanvas";
import { initialState } from "../editorReducer";
import SeatCanvas from "../SeatCanvas";
import { createInitialState } from "../seatEditorReducer";

// 브라우저가 포인터를 가져가면(터치 스크롤, 펜 이탈 등) pointerup 대신 pointercancel 이 온다.

test("섹션 에디터: pointercancel 이 오면 팬이 끝난다", () => {
  const { container } = render(
    <EditorCanvas state={{ ...initialState, tool: "pan" }} dispatch={jest.fn()} />,
  );
  const svg = container.querySelector("svg")!;
  fireEvent.pointerDown(svg, { button: 0, pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grabbing" });

  fireEvent.pointerCancel(svg, { pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grab" });
});

test("좌석 에디터: pointercancel 된 클릭은 좌석을 토글하지 않는다", () => {
  const dispatch = jest.fn();
  const state = {
    ...createInitialState(),
    seats: [{ id: "s1", x: 0, y: 0, gridRow: 0, number: 1, available: true }],
  };
  const { container } = render(<SeatCanvas state={state} dispatch={dispatch} />);
  const svg = container.querySelector("svg")!;

  fireEvent.pointerDown(svg, { button: 0, pointerId: 1 });
  fireEvent.pointerCancel(svg, { pointerId: 1 });
  // 취소 뒤 남은 드래그가 있으면 다음 pointerup 이 클릭으로 확정된다.
  fireEvent.pointerUp(svg, { pointerId: 1 });

  expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_SEATS_AVAILABLE" }));
});

test("좌석 에디터: pointercancel 이 오면 팬이 끝난다", () => {
  const state = { ...createInitialState(), tool: "pan" as const };
  const { container } = render(<SeatCanvas state={state} dispatch={jest.fn()} />);
  const svg = container.querySelector("svg")!;
  fireEvent.pointerDown(svg, { button: 0, pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grabbing" });

  fireEvent.pointerCancel(svg, { pointerId: 1 });
  expect(svg).toHaveStyle({ cursor: "grab" });
});
