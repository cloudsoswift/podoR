import { Suspense } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { TicketDetail } from "@/lib/api/mytickets";
import MyTicketDetailPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const seat = (itemSeq: number, seatNumber: number, status: "PAID" | "CANCELLED" = "PAID") => ({
  itemSeq,
  section: "A구역",
  rowNumber: "B",
  seatNumber,
  grade: "VIP",
  price: 10000,
  status,
  cancelledAt: status === "CANCELLED" ? "2026-10-20T10:00:00" : null,
});

const ticket = (patch: Partial<TicketDetail> = {}): TicketDetail => ({
  eventId: "E1",
  orderNumber: "O1",
  orderedAt: "2026-10-01T10:00:00",
  status: "PAID",
  cancelledAt: null,
  totalPrice: 30000,
  eventTitle: "봄 콘서트",
  venueName: "올림픽홀",
  eventDate: "2026-11-01T19:00:00",
  seats: [seat(11, 1), seat(12, 2), seat(13, 3)],
  ...patch,
});

/** 상세 조회는 호출마다 details 의 다음 값을, 부분 취소는 본문을 기록한다. */
function stub(details: TicketDetail[]) {
  const cancelBodies: { ticketingItemSeqs: number[] }[] = [];
  let call = 0;
  server.use(
    http.get(`${BASE_URL}/users/mytickets/O1`, () =>
      HttpResponse.json(details[Math.min(call++, details.length - 1)]),
    ),
    http.post(`${BASE_URL}/events/E1/order/O1/cancel`, async ({ request }) => {
      cancelBodies.push((await request.json()) as { ticketingItemSeqs: number[] });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return cancelBodies;
}

async function renderPage() {
  const params = Promise.resolve({ ticketId: "O1" });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MyTicketDetailPage params={params} />
      </Suspense>,
    );
  });
  await screen.findByText("봄 콘서트");
}

test("좌석을 골라 부분 취소하면 그 itemSeq 만 보내고 다시 불러온다", async () => {
  const after = ticket({
    status: "PARTIALLY_CANCELLED",
    totalPrice: 20000,
    seats: [seat(11, 1), seat(12, 2, "CANCELLED"), seat(13, 3)],
  });
  const bodies = stub([ticket(), after]);
  const user = userEvent.setup();
  await renderPage();

  const partial = screen.getByRole("button", { name: "선택한 좌석 취소" });
  expect(partial).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "A구역 B열 2번" }));
  await user.click(partial);
  expect(screen.getByText(/A구역 B열 2번/, { selector: "p" })).toBeInTheDocument();
  expect(screen.getByText(/환불 금액 10,000원/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "좌석 취소" }));

  await waitFor(() => expect(bodies).toEqual([{ ticketingItemSeqs: [12] }]));
  expect(await screen.findByText("부분 취소")).toBeInTheDocument();
  expect(screen.getByText("20,000원")).toBeInTheDocument();
});

test("취소된 좌석은 선택할 수 없고 취소됨으로 표시", async () => {
  stub([ticket({ status: "PARTIALLY_CANCELLED", seats: [seat(11, 1), seat(12, 2, "CANCELLED")] })]);
  await renderPage();

  expect(screen.getByRole("checkbox", { name: "A구역 B열 1번" })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "A구역 B열 2번" })).not.toBeInTheDocument();
  const row = screen.getByText("A구역 B열 2번").closest("li")!;
  expect(within(row).getByText(/취소됨/)).toBeInTheDocument();
});

test("부분 취소 상태에서도 전체 취소 버튼을 보여 준다", async () => {
  stub([ticket({ status: "PARTIALLY_CANCELLED", seats: [seat(11, 1), seat(12, 2, "CANCELLED")] })]);
  await renderPage();

  expect(screen.getByText("부분 취소")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "예매 취소" })).toBeInTheDocument();
});

test("전부 취소된 예매는 취소 버튼이 없다", async () => {
  stub([ticket({ status: "CANCELLED", seats: [seat(11, 1, "CANCELLED")] })]);
  await renderPage();

  expect(screen.queryByRole("button", { name: "예매 취소" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "선택한 좌석 취소" })).not.toBeInTheDocument();
});
