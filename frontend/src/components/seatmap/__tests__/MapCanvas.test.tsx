import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapCanvas from "../MapCanvas";
import { usePanZoom } from "../usePanZoom";
import { View } from "../viewport";

function Harness({ initial }: { initial?: View }) {
  const pz = usePanZoom(initial);
  return (
    <MapCanvas pz={pz} cursor="default">
      <circle data-testid="c" />
    </MapCanvas>
  );
}

test("줌 버튼으로 120% 확대 후 % 버튼으로 초기화된다", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "확대" }));
  expect(screen.getByTitle("뷰 초기화")).toHaveTextContent("120%");
  await user.click(screen.getByTitle("뷰 초기화"));
  expect(screen.getByTitle("뷰 초기화")).toHaveTextContent("100%");
});

test("initialView 가 있으면 초기화 시 그 뷰로 돌아간다", async () => {
  const user = userEvent.setup();
  render(<Harness initial={{ tx: 0, ty: 0, z: 2 }} />);
  expect(screen.getByTitle("뷰 초기화")).toHaveTextContent("200%");
  await user.click(screen.getByRole("button", { name: "확대" }));
  expect(screen.getByTitle("뷰 초기화")).toHaveTextContent("240%");
  await user.click(screen.getByTitle("뷰 초기화"));
  expect(screen.getByTitle("뷰 초기화")).toHaveTextContent("200%");
});

test("children 은 view transform 그룹 안에 그려진다", () => {
  render(<Harness />);
  expect(screen.getByTestId("c").parentElement).toHaveAttribute(
    "transform",
    "translate(0 0) scale(1)",
  );
});
