import { useEffect, useRef, useState } from "react";
import { clamp } from "./geometry";
import { Point } from "./types";
import { INITIAL_VIEW, MAX_Z, MIN_Z, View, zoomAround } from "./viewport";

export interface PanZoom {
  svgRef: React.RefObject<SVGSVGElement | null>;
  view: View;
  // 네이티브 휠 리스너·드래그 중에도 최신값을 읽도록 ref 로 미러링.
  viewRef: React.RefObject<View>;
  panning: boolean;
  applyView(v: View): void;
  resetView(): void;
  zoomBy(factor: number, root: Point): void;
  toRoot(clientX: number, clientY: number): Point;
  toContent(e: { clientX: number; clientY: number }): Point;
  beginPan(e: React.PointerEvent): void;
  updatePan(e: React.PointerEvent): boolean;
  endPan(e: React.PointerEvent): boolean;
}

interface PanDrag {
  startRoot: Point;
  startTx: number;
  startTy: number;
}

/**
 * 좌석맵 캔버스 공용 카메라(팬/줌). MapCanvas 와 함께 쓴다.
 * initialView 는 초기 뷰이자 resetView 의 목표이며, 값이 바뀌면 그 뷰로 이동한다.
 */
export function usePanZoom(initialView: View = INITIAL_VIEW): PanZoom {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setViewState] = useState<View>(initialView);
  const viewRef = useRef<View>(initialView);
  const [panning, setPanning] = useState(false);
  const panRef = useRef<PanDrag | null>(null);

  function applyView(next: View) {
    const v: View = { tx: next.tx, ty: next.ty, z: clamp(next.z, MIN_Z, MAX_Z) };
    viewRef.current = v;
    setViewState(v);
  }

  /** 화면 좌표 -> 루트(viewBox) 좌표. g 변환은 포함하지 않는다. */
  function toRoot(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /** 화면 좌표 -> 콘텐츠 좌표(카메라 역변환). clamp 하지 않는다. */
  function toContent(e: { clientX: number; clientY: number }): Point {
    const r = toRoot(e.clientX, e.clientY);
    const v = viewRef.current;
    return { x: (r.x - v.tx) / v.z, y: (r.y - v.ty) / v.z };
  }

  /** 주어진 루트 좌표를 고정점으로 factor 배 줌. */
  function zoomBy(factor: number, root: Point) {
    const next = zoomAround(viewRef.current, factor, root);
    if (next !== viewRef.current) applyView(next);
  }

  function beginPan(e: React.PointerEvent) {
    svgRef.current?.setPointerCapture?.(e.pointerId);
    const v = viewRef.current;
    panRef.current = {
      startRoot: toRoot(e.clientX, e.clientY),
      startTx: v.tx,
      startTy: v.ty,
    };
    setPanning(true);
  }

  function updatePan(e: React.PointerEvent): boolean {
    const pan = panRef.current;
    if (!pan) return false;
    const root = toRoot(e.clientX, e.clientY);
    applyView({
      z: viewRef.current.z,
      tx: pan.startTx + (root.x - pan.startRoot.x),
      ty: pan.startTy + (root.y - pan.startRoot.y),
    });
    return true;
  }

  function endPan(e: React.PointerEvent): boolean {
    if (!panRef.current) return false;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    setPanning(false);
    return true;
  }

  // initialView 변경(예: 좌석 맵에서 다른 섹션) 시 그 뷰로 이동.
  const { tx, ty, z } = initialView;
  useEffect(() => {
    applyView({ tx, ty, z });
  }, [tx, ty, z]);

  // 네이티브 휠 리스너(React onWheel 은 passive 라 preventDefault 가 불안정).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015), toRoot(e.clientX, e.clientY));
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    svgRef,
    view,
    viewRef,
    panning,
    applyView,
    resetView: () => applyView({ tx, ty, z }),
    zoomBy,
    toRoot,
    toContent,
    beginPan,
    updatePan,
    endPan,
  };
}
