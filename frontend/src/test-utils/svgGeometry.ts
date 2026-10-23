/**
 * jsdom 에는 SVG 좌표 변환(getScreenCTM)과 DOMPoint 가 없어 포인터 좌표가 모두 (0,0)이 된다.
 * 항등 변환으로 바꿔 clientX/Y 가 곧 viewBox(루트) 좌표가 되게 한다. 뷰가 초기값이면 콘텐츠 좌표와 같다.
 * 반환값을 호출하면 원래대로 되돌린다.
 */
export function stubSvgGeometry(): () => void {
  const proto = SVGSVGElement.prototype as unknown as { getScreenCTM?: () => unknown };
  const g = globalThis as unknown as { DOMPoint?: unknown };
  const origCTM = proto.getScreenCTM;
  const origPoint = g.DOMPoint;

  const identity = { inverse: () => identity };
  proto.getScreenCTM = () => identity;
  g.DOMPoint = class {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
    matrixTransform() {
      return { x: this.x, y: this.y };
    }
  };

  return () => {
    proto.getScreenCTM = origCTM;
    g.DOMPoint = origPoint;
  };
}
