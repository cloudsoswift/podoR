import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import EventSeatPlanEditor from "../EventSeatPlanEditor";
import { SeatPlanResponse, SeatPlanPayload } from "@/lib/api/seatPlan";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const initialPlan: SeatPlanResponse = {
  grades: [{ grade: "VIP", price: 0 }],
  sectionGrades: {},
  sellableSeats: [],
};

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/venues/1/layout`, () =>
      HttpResponse.json({ layoutJson: null }),
    ),
  );
});

test("가격을 숫자로 입력하면 3자리 콤마로 표시된다", async () => {
  const user = userEvent.setup();
  render(<EventSeatPlanEditor eventId="E1" venueSeq={1} initialPlan={initialPlan} />);

  const price = await screen.findByPlaceholderText("가격");
  await user.type(price, "30000");

  expect(price).toHaveValue("30,000");
});

test("저장 시 가격은 콤마 없는 숫자로 전송된다", async () => {
  const user = userEvent.setup();
  let sent: SeatPlanPayload | undefined;
  server.use(
    http.put(`${BASE_URL}/events/E1/seat-plan`, async ({ request }) => {
      sent = (await request.json()) as SeatPlanPayload;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  render(<EventSeatPlanEditor eventId="E1" venueSeq={1} initialPlan={initialPlan} />);
  const price = await screen.findByPlaceholderText("가격");
  await user.type(price, "1000");
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(sent).toBeDefined());
  expect(sent!.grades[0].price).toBe(1000);
});

test("제외 좌석의 행 라벨은 비가용 좌석만 있는 행도 포함해 위→아래로 매겨진다", async () => {
  const user = userEvent.setup();
  const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
  const seat = (gridRow: number, number: number, available = true) => ({
    id: `r${gridRow}-${number}`,
    x: number * 20,
    y: gridRow * 20,
    gridRow,
    number,
    available,
  });
  // gridRow 0(비가용만)=A, 2=B, 5=C. 비가용 행을 건너뛰면 B→A, C→B 로 어긋난다.
  const layoutJson = JSON.stringify({
    version: 1,
    sections: [
      {
        id: "s1",
        name: "A구역",
        color: "#000000",
        anchors: [anchor("a1", 0, 0), anchor("a2", 100, 0), anchor("a3", 100, 120), anchor("a4", 0, 120)],
      },
    ],
    seatsBySection: { s1: [seat(0, 1, false), seat(2, 1), seat(2, 2), seat(5, 1)] },
  });
  let sent: SeatPlanPayload | undefined;
  server.use(
    http.get(`${BASE_URL}/venues/1/layout`, () => HttpResponse.json({ layoutJson })),
    http.put(`${BASE_URL}/events/E1/seat-plan`, async ({ request }) => {
      sent = (await request.json()) as SeatPlanPayload;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const plan: SeatPlanResponse = {
    grades: [{ grade: "VIP", price: 1000 }],
    sectionGrades: { A구역: "VIP" },
    sellableSeats: [{ section: "A구역", rowNumber: "B", seatNumber: 1 }],
  };

  render(<EventSeatPlanEditor eventId="E1" venueSeq={1} initialPlan={plan} />);
  await waitFor(() => expect(screen.queryByText("좌석맵 불러오는 중…")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(sent).toBeDefined());
  expect(sent!.excludedSeats).toEqual([
    { section: "A구역", rowNumber: "B", seatNumber: 2 },
    { section: "A구역", rowNumber: "C", seatNumber: 1 },
  ]);
});
