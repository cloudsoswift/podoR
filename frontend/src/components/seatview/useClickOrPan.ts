import { useRef } from "react";
import { PanZoom } from "@/components/seatmap/usePanZoom";
import { CLICK_SLOP } from "@/components/seatmap/viewport";

/**
 * 예매 화면 캔버스 입력 규칙: 도구 전환 없이 좌클릭 드래그 = 팬, 제자리 클릭 = 섹션/좌석 클릭.
 * 이동이 CLICK_SLOP(화면 px)을 넘는 순간 팬으로 전환하고, 팬이 끝난 직후의 click 은 무시한다.
 * 지도 위 클릭 핸들러는 guardClick 으로 감싼다.
 */
export function useClickOrPan(pz: PanZoom) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    suppressClickRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pz.updatePan(e)) return;
    const start = startRef.current;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) {
      startRef.current = null;
      suppressClickRef.current = true;
      pz.beginPan(e);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    startRef.current = null;
    pz.endPan(e);
  }

  // 키보드 선택은 팬과 무관하다. 좌석 핸들러보다 먼저(캡처 단계) 억제를 푼다.
  function onKeyDownCapture() {
    suppressClickRef.current = false;
  }

  function guardClick(fn: () => void) {
    return () => {
      if (suppressClickRef.current) return;
      fn();
    };
  }

  return {
    svgProps: { onPointerDown, onPointerMove, onPointerUp, onKeyDownCapture },
    guardClick,
  };
}
