import { StrictMode, Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { isPaymentRedirect, markPaymentRedirect } from "@/lib/paymentRedirect";
import PaymentSuccessPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearch,
}));

async function renderPage() {
  const params = Promise.resolve({ eventId: "E1" });
  await act(async () => {
    render(
      <StrictMode>
        <Suspense fallback={null}>
          <PaymentSuccessPage params={params} />
        </Suspense>
      </StrictMode>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockSearch = new URLSearchParams("paymentType=NORMAL&paymentKey=PK1&orderId=N1&amount=30000");
});

test("쿼리로_확정을_한번_호출하고_완료페이지로", async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${BASE_URL}/events/E1/order/N1/confirm`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ orderNumber: "N1" });
    }),
  );
  markPaymentRedirect("E1");

  await renderPage();

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/order/N1/complete"));
  expect(bodies).toEqual([{ paymentKey: "PK1", amount: 30000 }]);
  expect(isPaymentRedirect("E1")).toBe(false);
});

test("확정에 실패하면 사유와 좌석 다시 선택 링크를 보여준다", async () => {
  server.use(
    http.post(`${BASE_URL}/events/E1/order/N1/confirm`, () =>
      HttpResponse.json({ detail: "선점이 만료되었습니다." }, { status: 409 }),
    ),
  );

  await renderPage();

  expect(await screen.findByText("선점이 만료되었습니다.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "좌석 다시 선택" })).toHaveAttribute("href", "/events/E1/seats");
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
