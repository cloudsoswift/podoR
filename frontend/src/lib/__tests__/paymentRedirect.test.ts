import { clearPaymentRedirect, isPaymentRedirect, markPaymentRedirect } from "../paymentRedirect";

beforeEach(() => sessionStorage.clear());

test("설정하면 그 회차만 이동 중으로 본다", () => {
  expect(isPaymentRedirect("E1")).toBe(false);

  markPaymentRedirect("E1");

  expect(isPaymentRedirect("E1")).toBe(true);
  expect(isPaymentRedirect("E2")).toBe(false);
  expect(sessionStorage.getItem("payment-redirect:E1")).not.toBeNull();
});

test("해제하면 더 이상 이동 중이 아니다", () => {
  markPaymentRedirect("E1");

  clearPaymentRedirect("E1");

  expect(isPaymentRedirect("E1")).toBe(false);
});

test("sessionStorage 를 못 쓰면 이동 중이 아닌 것으로 본다", () => {
  const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });

  expect(() => markPaymentRedirect("E1")).not.toThrow();
  expect(isPaymentRedirect("E1")).toBe(false);
  expect(() => clearPaymentRedirect("E1")).not.toThrow();
  spy.mockRestore();
  jest.restoreAllMocks();
});
