import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventFormModal from "../EventFormModal";

/** 공연장 검색 새 창이 보내는 postMessage 를 흉내낸다. */
function pick(data: unknown, origin: string) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  });
}

test("검색 버튼이 공연장 검색 창을 연다", async () => {
  const user = userEvent.setup();
  const open = jest.fn();
  window.open = open as unknown as typeof window.open;

  render(<EventFormModal open event={null} onSubmit={jest.fn()} onCancel={jest.fn()} />);
  await user.click(screen.getByRole("button", { name: "검색" }));

  expect(open).toHaveBeenCalledWith(
    "/admin/venues/search",
    "venue-search",
    expect.stringContaining("width="),
  );
});

test("같은 origin 의 venue-picked 메시지만 폼에 반영된다", async () => {
  render(<EventFormModal open event={null} onSubmit={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.getByText("선택되지 않음")).toBeInTheDocument();

  pick({ type: "venue-picked", seq: 7, name: "올림픽홀" }, window.location.origin);
  expect(await screen.findByText("올림픽홀")).toBeInTheDocument();

  // 다른 origin 은 무시 — 표시가 바뀌지 않는다
  pick({ type: "venue-picked", seq: 9, name: "가짜홀" }, "https://evil.example");
  expect(screen.queryByText("가짜홀")).not.toBeInTheDocument();
  expect(screen.getByText("올림픽홀")).toBeInTheDocument();
});
