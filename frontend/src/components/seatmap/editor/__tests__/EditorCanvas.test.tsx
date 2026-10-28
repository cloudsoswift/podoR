import { render } from "@testing-library/react";
import { Section } from "@/components/seatmap/core/types";
import EditorCanvas from "../EditorCanvas";
import { initialState } from "../editorReducer";

const a = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const square = (id: string, x: number, y: number, s: number): Section => ({
  id,
  name: id,
  color: "#6366f1",
  anchors: [a(`${id}1`, x, y), a(`${id}2`, x + s, y), a(`${id}3`, x + s, y + s), a(`${id}4`, x, y + s)],
});

test("겹친 섹션만 빨갛게 표시한다", () => {
  const sections = [square("a", 0, 0, 100), square("b", 50, 50, 100), square("c", 400, 400, 50)];
  const { container } = render(
    <EditorCanvas state={{ ...initialState, tool: "select", sections }} dispatch={jest.fn()} />,
  );
  const invalid = container.querySelectorAll('path[data-invalid="true"]');
  expect(invalid).toHaveLength(2);
  expect(invalid[0]).toHaveAttribute("stroke", "#ef4444");
});
