import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
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
    http.get("http://localhost:8080/venues/1/layout", () =>
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
    http.put("http://localhost:8080/events/E1/seat-plan", async ({ request }) => {
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
