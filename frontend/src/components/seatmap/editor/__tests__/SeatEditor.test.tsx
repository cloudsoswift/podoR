import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeatEditor from "../SeatEditor";

const seats = [{ id: "a", x: 0, y: 0, gridRow: 0, number: 1, available: true }];
const grid = { colPitch: 25, rowPitch: 30 };

test("저장된 간격으로 재진입하면 툴바에 그 간격이 보인다", () => {
  render(<SeatEditor initialSeats={seats} initialGrid={grid} onExit={jest.fn()} />);
  expect(screen.getByLabelText("가로 간격")).toHaveValue(25);
  expect(screen.getByLabelText("세로 간격")).toHaveValue(30);
});

test("나갈 때 좌석과 좌석을 만든 간격을 함께 넘긴다(재생성 없이 바꾼 툴바 값은 제외)", async () => {
  const user = userEvent.setup();
  const onExit = jest.fn();
  render(<SeatEditor initialSeats={seats} initialGrid={grid} onExit={onExit} />);

  const col = screen.getByLabelText("가로 간격");
  await user.clear(col);
  await user.type(col, "40");
  await user.click(screen.getByRole("button", { name: /섹션/ }));

  expect(onExit).toHaveBeenCalledWith(seats, grid);
});
