import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeatDot from "../SeatDot";

const base = { x: 10, y: 10, r: 5, fill: "#000", stroke: "#fff", strokeWidth: 1 };

function renderDot(props: Partial<React.ComponentProps<typeof SeatDot>> = {}) {
  return render(
    <svg>
      <SeatDot {...base} {...props} />
    </svg>,
  );
}

test("label 이 있으면 접근 가능한 이름과 툴팁이 된다", () => {
  renderDot({ label: "A열 1번 · VIP", onClick: jest.fn() });
  const dot = screen.getByRole("button", { name: "A열 1번 · VIP" });
  // getByTitle 은 <svg> 직계 <title> 만 찾으므로 circle 의 툴팁은 직접 확인한다.
  expect(dot.querySelector("title")).toHaveTextContent("A열 1번 · VIP");
});

test("disabled 면 클릭해도 onClick 이 호출되지 않는다", async () => {
  const onClick = jest.fn();
  renderDot({ label: "A열 1번", onClick, disabled: true });
  const dot = screen.getByRole("button", { name: "A열 1번" });
  expect(dot).toHaveAttribute("aria-disabled", "true");
  await userEvent.setup().click(dot);
  expect(onClick).not.toHaveBeenCalled();
});

test("키보드 포커스 후 Enter/Space 로 선택된다", async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  renderDot({ label: "A열 1번", onClick });
  await user.tab();
  expect(screen.getByRole("button", { name: "A열 1번" })).toHaveFocus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(onClick).toHaveBeenCalledTimes(2);
});

test("disabled 좌석은 탭 순서에서 빠진다", () => {
  renderDot({ label: "A열 1번", onClick: jest.fn(), disabled: true });
  expect(screen.getByRole("button", { name: "A열 1번" })).toHaveAttribute("tabindex", "-1");
});

test("onClick 이 없으면 포인터를 받지 않는다", () => {
  const { container } = renderDot();
  const circle = container.querySelector("circle")!;
  expect(circle).toHaveStyle({ pointerEvents: "none" });
  expect(circle).not.toHaveAttribute("role");
});
