import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("좌석 맵", () => {
  const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
  const rect = (id: string, name: string, x: number) => ({
    id,
    name,
    color: "#4f46e5",
    anchors: [anchor(`${id}a`, x, 0), anchor(`${id}b`, x + 100, 0), anchor(`${id}c`, x + 100, 40), anchor(`${id}d`, x, 40)],
  });
  const seat = (id: string, x: number, number: number) => ({ id, x, y: 20, gridRow: 0, number, available: true });
  // A구역(VIP 등급) 2석 + B구역(등급 없음 = 미판매) 1석.
  const doc = {
    version: 1,
    sections: [rect("s1", "A구역", 0), rect("s2", "B구역", 200)],
    seatsBySection: { s1: [seat("a1", 20, 1), seat("a2", 40, 2)], s2: [seat("b1", 220, 1)] },
  };
  const plan: SeatPlanResponse = {
    grades: [{ grade: "VIP", price: 1000 }],
    sectionGrades: { A구역: "VIP" },
    sellableSeats: [
      { section: "A구역", rowNumber: "A", seatNumber: 1 },
      { section: "A구역", rowNumber: "A", seatNumber: 2 },
    ],
  };

  function setup(layout: object = doc) {
    let sent: SeatPlanPayload | undefined;
    server.use(
      http.get(`${BASE_URL}/venues/1/layout`, () => HttpResponse.json({ layoutJson: JSON.stringify(layout) })),
      http.put(`${BASE_URL}/events/E1/seat-plan`, async ({ request }) => {
        sent = (await request.json()) as SeatPlanPayload;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const utils = render(<EventSeatPlanEditor eventId="E1" venueSeq={1} initialPlan={plan} />);
    return { ...utils, sent: () => sent };
  }

  test("등급이 없는 섹션도 테두리를 그린다", async () => {
    const { container } = setup();
    await screen.findByRole("button", { name: "A구역 A열 1번" });
    // 캔버스 콘텐츠 그룹 바로 아래의 path = 섹션 테두리.
    expect(container.querySelectorAll("svg > g > path")).toHaveLength(2);
  });

  test("등급 섹션 좌석은 클릭으로 제외되고, 미판매 섹션 좌석은 클릭할 수 없다", async () => {
    const user = userEvent.setup();
    const { sent } = setup();
    await user.click(await screen.findByRole("button", { name: "A구역 A열 2번" }));
    expect(screen.queryByRole("button", { name: "B구역 A열 1번" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(sent()).toBeDefined());
    expect(sent()!.excludedSeats).toEqual([{ section: "A구역", rowNumber: "A", seatNumber: 2 }]);
  });

  test("드래그로 화면을 옮긴 뒤에는 좌석이 토글되지 않는다", async () => {
    const user = userEvent.setup();
    const { container, sent } = setup();
    const target = await screen.findByRole("button", { name: "A구역 A열 2번" });
    const svg = container.querySelector("svg")!;
    fireEvent.pointerDown(target, { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 0, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.click(target);

    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(sent()).toBeDefined());
    expect(sent()!.excludedSeats).toEqual([]);
  });

  test("좌석 반지름은 저장된 간격으로 계산한다", async () => {
    setup({ ...doc, gridBySection: { s1: { colPitch: 25, rowPitch: 30 } } });
    // min(25,30)*0.4 = 10. 좌표로 추정하면 간격 20 → 8.
    expect(await screen.findByRole("button", { name: "A구역 A열 1번" })).toHaveAttribute("r", "10");
  });
});
