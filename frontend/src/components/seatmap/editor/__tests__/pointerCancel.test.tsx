import { fireEvent, render } from "@testing-library/react";
import EditorCanvas from "../EditorCanvas";
import { initialState } from "../editorReducer";

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
