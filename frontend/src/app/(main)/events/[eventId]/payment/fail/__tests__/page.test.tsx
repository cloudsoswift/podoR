import { StrictMode, Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { isPaymentRedirect, markPaymentRedirect } from "@/lib/paymentRedirect";
import PaymentFailPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearch,
}));

function stub() {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${BASE_URL}/events/E1/order/N1/fail`, async ({ request }) => {
      bodies.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return bodies;
}

async function renderPage() {
  const params = Promise.resolve({ eventId: "E1" });
  await act(async () => {
    render(
      <StrictMode>
        <Suspense fallback={null}>
          <PaymentFailPage params={params} />
        </Suspense>
      </StrictMode>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

test("사용자취소_문구와_실패기록", async () => {
  const bodies = stub();
  mockSearch = new URLSearchParams(
    "orderNumber=N1&seats=1,2&code=PAY_PROCESS_CANCELED&message=%EC%82%AC%EC%9A%A9%EC%9E%90%EC%97%90+%EC%9D%98%ED%95%B4&orderId=N1",
  );
  markPaymentRedirect("E1");

  await renderPage();

  expect(await screen.findByText("결제를 취소했습니다.")).toBeInTheDocument();
  await waitFor(() =>
    expect(bodies).toEqual([{ code: "PAY_PROCESS_CANCELED", message: "사용자에 의해" }]),
  );
  expect(isPaymentRedirect("E1")).toBe(false);
});

test("그 외 실패는 토스 메시지를 보여준다", async () => {
  stub();
  mockSearch = new URLSearchParams("orderNumber=N1&seats=1&code=REJECT_CARD_COMPANY&message=카드사에서 거절했습니다.");

  await renderPage();

  expect(await screen.findByText("카드사에서 거절했습니다.")).toBeInTheDocument();
});

test("다시_결제하기_링크에_좌석유지", async () => {
  stub();
  mockSearch = new URLSearchParams("orderNumber=N1&seats=1,2&code=PAY_PROCESS_CANCELED&message=x");

  await renderPage();

  expect(await screen.findByRole("link", { name: "다시 결제하기" })).toHaveAttribute(
    "href",
    "/events/E1/seats/payment?seats=1,2",
  );
  expect(screen.getByRole("link", { name: "좌석 다시 선택" })).toHaveAttribute("href", "/events/E1/seats");
});
