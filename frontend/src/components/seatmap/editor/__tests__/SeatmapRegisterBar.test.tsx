import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { newRow } from "@/components/seatmap/core/rowGeometry";
import { SeatmapPayload } from "@/components/seatmap/core/seatmapApi";
import { Section } from "@/components/seatmap/core/types";
import SeatmapRegisterBar from "../SeatmapRegisterBar";

const anchor = (id: string, x: number, y: number) => ({ id, x, y, handleIn: null, handleOut: null });
const section: Section = {
  id: "s1",
  name: "A구역",
  color: "#000",
  anchors: [anchor("a", 0, 0), anchor("b", 300, 0), anchor("c", 300, 200), anchor("d", 0, 200)],
};

function stubRegister() {
  const bodies: SeatmapPayload[] = [];
  server.use(
    http.post(`${BASE_URL}/venues/1/seatmap`, async ({ request }) => {
      const body = (await request.json()) as SeatmapPayload;
      bodies.push(body);
      return HttpResponse.json({ venueSeq: 1, layoutSaved: true, seatCount: body.seats.length });
    }),
  );
  return bodies;
}

test("저장을 막는 문제가 있으면 사유를 보여 주고 요청하지 않는다", async () => {
  const bodies = stubRegister();
  render(
    <SeatmapRegisterBar
      venueSeq={1}
      sections={[section]}
      rowsBySection={{ s1: [newRow("r1", 3, { x: 100, y: 100 })] }}
    />,
  );
  expect(screen.getByText("A구역: 이름 없는 줄 1개")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "저장" });
  expect(save).toBeDisabled();
  await userEvent.setup().click(save);
  expect(bodies).toHaveLength(0);
});

test("문제가 없으면 번호 있는 좌석을 보낸다", async () => {
  const bodies = stubRegister();
  const row = { ...newRow("r1", 3, { x: 100, y: 100 }), name: "A", unavailable: [1], skipUnavailableNumbers: true };
  render(<SeatmapRegisterBar venueSeq={1} sections={[section]} rowsBySection={{ s1: [row] }} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0].seats).toHaveLength(2);
  expect(await screen.findByText(/저장 완료/)).toBeInTheDocument();
});
