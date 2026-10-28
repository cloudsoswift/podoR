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

const preview = (cancelSeatCount: number, cancelOrderCount: number) => ({
  code: "SEATMAP_CANCEL_CONFIRM_REQUIRED",
  cancelSeatCount,
  cancelOrderCount,
  events: [{ eventId: "E1", title: "봄 콘서트", eventDate: "2026-11-01T19:00:00", seatCount: cancelSeatCount }],
});

/** 확인 수가 기대값과 같을 때만 저장, 아니면 409 + 미리보기(최신 수). */
function stubConfirmFlow(counts: number[]) {
  const bodies: SeatmapPayload[] = [];
  let call = 0;
  server.use(
    http.post(`${BASE_URL}/venues/1/seatmap`, async ({ request }) => {
      const body = (await request.json()) as SeatmapPayload;
      bodies.push(body);
      const expected = counts[Math.min(call++, counts.length - 1)];
      if (body.confirmedCancelSeatCount !== expected) {
        return HttpResponse.json(preview(expected, 2), { status: 409 });
      }
      return HttpResponse.json({ venueSeq: 1, layoutSaved: true, seatCount: body.seats.length });
    }),
  );
  return bodies;
}

const namedRow = () => ({ ...newRow("r1", 3, { x: 100, y: 100 }), name: "A" });

test("예매가 취소되는 저장은 확인 창을 띄우고, 확인하면 확인 수를 붙여 다시 보낸다", async () => {
  const bodies = stubConfirmFlow([3]);
  const user = userEvent.setup();
  render(<SeatmapRegisterBar venueSeq={1} sections={[section]} rowsBySection={{ s1: [namedRow()] }} />);
  await user.click(screen.getByRole("button", { name: "저장" }));

  expect(await screen.findByText(/주문 2건\(3석\)/)).toBeInTheDocument();
  expect(screen.getByText(/봄 콘서트/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "예매 취소하고 저장" }));

  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0].confirmedCancelSeatCount).toBeUndefined();
  expect(bodies[1].confirmedCancelSeatCount).toBe(3);
  expect(await screen.findByText(/저장 완료/)).toBeInTheDocument();
});

test("확인 창에서 돌아가면 다시 보내지 않는다", async () => {
  const bodies = stubConfirmFlow([3]);
  const user = userEvent.setup();
  render(<SeatmapRegisterBar venueSeq={1} sections={[section]} rowsBySection={{ s1: [namedRow()] }} />);
  await user.click(screen.getByRole("button", { name: "저장" }));
  await user.click(await screen.findByRole("button", { name: "돌아가기" }));

  expect(screen.queryByText(/주문 2건/)).not.toBeInTheDocument();
  expect(bodies).toHaveLength(1);
});

test("확인하는 사이 취소 수가 바뀌면 새 수로 다시 확인받는다", async () => {
  // 첫 요청 3석 → 확인(3) 시점엔 이미 4석
  const bodies = stubConfirmFlow([3, 4, 4]);
  const user = userEvent.setup();
  render(<SeatmapRegisterBar venueSeq={1} sections={[section]} rowsBySection={{ s1: [namedRow()] }} />);
  await user.click(screen.getByRole("button", { name: "저장" }));
  await user.click(await screen.findByRole("button", { name: "예매 취소하고 저장" }));

  expect(await screen.findByText(/주문 2건\(4석\)/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "예매 취소하고 저장" }));
  await waitFor(() => expect(bodies).toHaveLength(3));
  expect(bodies[2].confirmedCancelSeatCount).toBe(4);
  expect(await screen.findByText(/저장 완료/)).toBeInTheDocument();
});
