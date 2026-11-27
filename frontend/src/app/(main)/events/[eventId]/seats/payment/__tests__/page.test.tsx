import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { isPaymentRedirect } from "@/lib/paymentRedirect";
import PaymentPage from "../page";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockSearch = new URLSearchParams("seats=1,2");
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearch,
}));

const mockWidgets = {
  setAmount: jest.fn(),
  renderPaymentMethods: jest.fn(),
  renderAgreement: jest.fn(),
  requestPayment: jest.fn(),
};
const mockWidgetsFactory = jest.fn(() => mockWidgets);
jest.mock("@tosspayments/tosspayments-sdk", () => ({
  ANONYMOUS: "@@ANONYMOUS",
  loadTossPayments: jest.fn(async () => ({ widgets: mockWidgetsFactory })),
}));
const mockedLoad = loadTossPayments as jest.MockedFunction<typeof loadTossPayments>;

const PREPARED = { orderNumber: "N1", amount: 30000, orderName: "봄 콘서트 2석" };

/** 준비·확정·선점 해제 요청을 기록한다. */
function stub() {
  const prepareBodies: unknown[] = [];
  const confirmBodies: unknown[] = [];
  const releaseBodies: unknown[] = [];
  server.use(
    http.post(`${BASE_URL}/events/E1/order`, async ({ request }) => {
      prepareBodies.push(await request.json());
      return HttpResponse.json(PREPARED, { status: 201 });
    }),
    http.post(`${BASE_URL}/events/E1/order/N1/confirm`, async ({ request }) => {
      confirmBodies.push(await request.json());
      return HttpResponse.json({ orderNumber: "N1" });
    }),
    http.delete(`${BASE_URL}/events/E1/holds`, async ({ request }) => {
      releaseBodies.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { prepareBodies, confirmBodies, releaseBodies };
}

async function renderPage() {
  const params = Promise.resolve({ eventId: "E1" });
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <PaymentPage params={params} />
      </Suspense>,
    );
  });
  return utils;
}

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockSearch = new URLSearchParams("seats=1,2");
  mockWidgets.setAmount.mockResolvedValue(undefined);
  mockWidgets.renderPaymentMethods.mockResolvedValue({});
  mockWidgets.renderAgreement.mockResolvedValue({});
  mockWidgets.requestPayment.mockResolvedValue(undefined);
  delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  else process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = ORIGINAL_KEY;
});

test("키가_없으면_모의결제_버튼으로_준비후_확정", async () => {
  const { prepareBodies, confirmBodies } = stub();
  await renderPage();

  const button = await screen.findByRole("button", { name: "모의 결제" });
  await waitFor(() => expect(button).toBeEnabled());
  expect(prepareBodies).toEqual([{ eventSeatSeqs: [1, 2] }]);
  expect(screen.getByText("선점은 15분간 유효합니다.", { exact: false })).toBeInTheDocument();
  expect(mockedLoad).not.toHaveBeenCalled();

  await userEvent.click(button);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/order/N1/complete"));
  expect(confirmBodies).toEqual([{ paymentKey: "mock-N1", amount: 30000 }]);
});

test("키가_있으면_위젯을_금액과_함께_렌더하고_결제요청에_주문번호를_넘긴다", async () => {
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = "test_gck_key";
  const { prepareBodies } = stub();
  await renderPage();

  await waitFor(() => expect(mockWidgets.renderAgreement).toHaveBeenCalled());
  expect(prepareBodies).toEqual([{ eventSeatSeqs: [1, 2] }]);
  expect(mockedLoad).toHaveBeenCalledWith("test_gck_key");
  expect(mockWidgetsFactory).toHaveBeenCalledWith({ customerKey: "@@ANONYMOUS" });
  expect(mockWidgets.setAmount).toHaveBeenCalledWith({ currency: "KRW", value: 30000 });
  expect(mockWidgets.renderPaymentMethods).toHaveBeenCalledWith({ selector: "#payment-method" });
  expect(mockWidgets.renderAgreement).toHaveBeenCalledWith({ selector: "#agreement" });
  // 금액을 정한 뒤에 결제수단을 그린다(아니면 SDK 가 NotSetupAmountError)
  expect(mockWidgets.setAmount.mock.invocationCallOrder[0]).toBeLessThan(
    mockWidgets.renderPaymentMethods.mock.invocationCallOrder[0],
  );

  const button = screen.getByRole("button", { name: "결제하기" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);

  expect(mockWidgets.requestPayment).toHaveBeenCalledWith({
    orderId: "N1",
    orderName: "봄 콘서트 2석",
    successUrl: "http://localhost/events/E1/payment/success",
    failUrl: "http://localhost/events/E1/payment/fail?orderNumber=N1&seats=1%2C2",
  });
});

test("토스로_이동하면_선점을_해제하지_않는다", async () => {
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = "test_gck_key";
  const { releaseBodies } = stub();
  const { unmount } = await renderPage();

  const button = await screen.findByRole("button", { name: "결제하기" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  expect(mockWidgets.requestPayment).toHaveBeenCalled();

  // 결제창으로 페이지가 넘어가는 순간
  window.dispatchEvent(new Event("beforeunload"));
  unmount();
  await act(() => new Promise((r) => setTimeout(r, 200)));

  expect(releaseBodies).toEqual([]);
});

test("결제 없이 떠나면 선점을 해제한다", async () => {
  const { releaseBodies } = stub();
  const { unmount } = await renderPage();
  await screen.findByRole("button", { name: "모의 결제" });

  unmount();

  await waitFor(() => expect(releaseBodies).toEqual([{ eventSeatSeqs: [1, 2] }]));
});

test("결제창에서 bfcache 로 돌아오면(pageshow persisted) 버튼과 이동 표시를 되돌린다", async () => {
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = "test_gck_key";
  stub();
  await renderPage();

  await userEvent.click(await screen.findByRole("button", { name: "결제하기" }));
  expect(screen.getByRole("button", { name: "결제창으로 이동 중…" })).toBeDisabled();
  expect(isPaymentRedirect("E1")).toBe(true);

  await act(async () => {
    const e = new Event("pageshow");
    Object.defineProperty(e, "persisted", { value: true });
    window.dispatchEvent(e);
  });

  expect(await screen.findByRole("button", { name: "결제하기" })).toBeEnabled();
  expect(isPaymentRedirect("E1")).toBe(false);
});
