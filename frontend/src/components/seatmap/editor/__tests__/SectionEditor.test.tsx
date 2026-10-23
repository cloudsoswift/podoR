import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Section } from "@/components/seatmap/core/types";
import { stubSvgGeometry } from "@/test-utils/svgGeometry";
import SectionEditor from "../SectionEditor";

const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const section: Section = {
  id: "s1",
  name: "A구역",
  color: "#123456",
  anchors: [anchor("a", 100, 100), anchor("b", 200, 100), anchor("c", 200, 200), anchor("d", 100, 200)],
};

let restore: () => void;
beforeEach(() => {
  restore = stubSvgGeometry();
});
afterEach(() => restore());

test("섹션을 끌어 옮기면 onSectionMove 로 이동량을 알린다", async () => {
  const onSectionMove = jest.fn();
  const { container } = render(<SectionEditor initialSections={[section]} onSectionMove={onSectionMove} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "선택" }));
  const body = container.querySelector(`path[fill="${section.color}"]`)!;
  const svg = container.querySelector("svg")!;
  fireEvent.pointerDown(body, { clientX: 150, clientY: 150, button: 0, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 155, clientY: 150, buttons: 1, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX: 160, clientY: 150, buttons: 1, pointerId: 1 });
  fireEvent.pointerUp(svg, { clientX: 160, clientY: 150, pointerId: 1 });

  const calls = onSectionMove.mock.calls;
  expect(calls.every(([id]) => id === "s1")).toBe(true);
  expect(calls.reduce((sum, [, dx]) => sum + dx, 0)).toBe(10);
  expect(calls.reduce((sum, [, , dy]) => sum + dy, 0)).toBe(0);
});

test("밑그림 상태를 onBackgroundChange 로 알린다(없으면 null)", () => {
  const onBackgroundChange = jest.fn();
  render(<SectionEditor onBackgroundChange={onBackgroundChange} />);
  expect(onBackgroundChange).toHaveBeenCalledWith(null);
});
