import "@testing-library/jest-dom";
import { server } from "@/mocks/server";

// jsdom 에는 PointerEvent 가 없어 fireEvent.pointer* 가 button/clientX/pointerId 를 버린다.
if (!window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}
// jsdom 에는 포인터 캡처 API 도 없다(캔버스 드래그가 pointerdown 에서 호출).
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
