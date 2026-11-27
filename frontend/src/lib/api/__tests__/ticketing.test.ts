import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { BASE_URL } from "@/mocks/handlers";
import { confirmPayment, failPayment } from "../ticketing";

function capture() {
  const urls: string[] = [];
  server.use(
    http.post(`${BASE_URL}/events/*`, ({ request }) => {
      urls.push(new URL(request.url).pathname);
      return HttpResponse.json({ orderNumber: "x" });
    }),
  );
  return urls;
}

test("confirmPayment 는 orderNumber·eventId 를 인코딩해 같은 경로 안에 가둔다", async () => {
  const urls = capture();
  await confirmPayment("E/1", "../x", { paymentKey: "k", amount: 1 });
  expect(urls).toEqual(["/api/events/E%2F1/order/..%2Fx/confirm"]);
});

test("failPayment 는 orderNumber·eventId 를 인코딩해 같은 경로 안에 가둔다", async () => {
  const urls = capture();
  await failPayment("E/1", "../x", { code: "c", message: "m" });
  expect(urls).toEqual(["/api/events/E%2F1/order/..%2Fx/fail"]);
});
