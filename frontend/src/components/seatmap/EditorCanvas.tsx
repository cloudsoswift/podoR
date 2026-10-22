import { useRef } from "react";
import { clamp, dist, snapCornerRightAngle, snapToRightAngle } from "./geometry";
import {
  CLOSE_RADIUS,
  EditorAction,
  EditorState,
  MIN_ANCHORS,
  VIEW_H,
  VIEW_W,
} from "./editorReducer";
import { BgCorner, HandleSide, Point } from "./types";
import BackgroundLayer from "./BackgroundLayer";
import DraftLayer from "./DraftLayer";
import SectionShape from "./SectionShape";
import MapCanvas from "./MapCanvas";
import { usePanZoom } from "./usePanZoom";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const DBL_MS = 300;

type DragTarget =
  | { kind: "anchor"; sectionId: string; anchorId: string }
  | { kind: "handle"; sectionId: string; anchorId: string; side: HandleSide }
  | { kind: "section"; sectionId: string; last: Point }
  | { kind: "bg-move"; last: Point }
  | { kind: "bg-resize"; corner: BgCorner; fixed: Point };

export default function EditorCanvas({ state, dispatch }: Props) {
  const dragRef = useRef<DragTarget | null>(null);
  // 포인터 캡처가 click 을 SVG 로 재타게팅하므로, 도형/앵커 조작 후의 click 은 무시한다.
  const suppressClickRef = useRef(false);
  // 더블클릭 직접 감지용(앵커=곡선/직선 토글, 핸들=한쪽 직선화).
  const lastAnchorClickRef = useRef<{ anchorId: string; time: number } | null>(
    null,
  );
  const lastHandleClickRef = useRef<{
    anchorId: string;
    side: HandleSide;
    time: number;
  } | null>(null);

  // 카메라(팬/줌)는 공용 뷰포트 훅이 관리한다.
  const pz = usePanZoom();
  const { svgRef, view, viewRef, toContent } = pz;

  /** 화면 좌표 -> 콘텐츠 좌표 후 종이 영역으로 clamp. */
  function toSvg(e: React.PointerEvent | React.MouseEvent): Point {
    const c = toContent(e);
    return { x: clamp(c.x, 0, VIEW_W), y: clamp(c.y, 0, VIEW_H) };
  }

  /** 펜 입력 좌표. Shift 를 누르면 직전 점 기준 직각으로 각도 고정. */
  function penPoint(e: React.PointerEvent | React.MouseEvent): Point {
    const p = toSvg(e);
    if (e.shiftKey && state.draft.length > 0) {
      return snapToRightAngle(state.draft[state.draft.length - 1], p);
    }
    return p;
  }

  /**
   * 앵커 드래그 좌표. Shift 를 누르면 양 이웃 앵커와 직각을 이루는 위치로 스냅한다.
   * (닫힌 루프이므로 prev/next 두 이웃이 항상 존재. 이웃이 겹치면 스냅하지 않는다.)
   */
  function anchorPoint(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
  ): Point {
    if (!e.shiftKey) return toSvg(e);
    const sec = state.sections.find((s) => s.id === sectionId);
    if (!sec) return toSvg(e);
    const n = sec.anchors.length;
    const i = sec.anchors.findIndex((a) => a.id === anchorId);
    if (i < 0 || n < 3) return toSvg(e);
    const prev = sec.anchors[(i - 1 + n) % n];
    const next = sec.anchors[(i + 1) % n];
    const snapped = snapCornerRightAngle(prev, next, toContent(e));
    return { x: clamp(snapped.x, 0, VIEW_W), y: clamp(snapped.y, 0, VIEW_H) };
  }

  // 가운데 버튼(button 1)은 어느 도구에서나 팬. (키보드 조합 아님)
  function shouldPan(e: React.PointerEvent): boolean {
    return state.tool === "pan" || e.button === 1;
  }

  function startPan(e: React.PointerEvent) {
    e.stopPropagation();
    suppressClickRef.current = true;
    pz.beginPan(e);
  }

  function beginSectionDrag(e: React.PointerEvent, sectionId: string) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;
    dispatch({ type: "SELECT_SECTION", id: sectionId });
    // 선택 도구에서만 바디 드래그로 섹션 전체를 옮긴다.
    if (state.tool === "select") {
      svgRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "section", sectionId, last: toSvg(e) };
    }
  }

  function beginAnchorDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
  ) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;

    // 더블클릭: 곡선 앵커면 직선화, 코너면 곡선화 토글.
    const now = Date.now();
    const prev = lastAnchorClickRef.current;
    if (prev && prev.anchorId === anchorId && now - prev.time < DBL_MS) {
      lastAnchorClickRef.current = null;
      dragRef.current = null;
      const sec = state.sections.find((s) => s.id === sectionId);
      const a = sec?.anchors.find((an) => an.id === anchorId);
      const hasHandles = !!(a && (a.handleIn || a.handleOut));
      dispatch({
        type: hasHandles ? "STRAIGHTEN_ANCHOR" : "SMOOTH_ANCHOR",
        sectionId,
        anchorId,
      });
      return;
    }
    lastAnchorClickRef.current = { anchorId, time: now };

    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "anchor", sectionId, anchorId };
  }

  function beginHandleDrag(
    e: React.PointerEvent,
    sectionId: string,
    anchorId: string,
    side: HandleSide,
  ) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;

    // 같은 핸들을 더블클릭하면 해당 변을 직선화(핸들 제거).
    const now = Date.now();
    const prev = lastHandleClickRef.current;
    if (
      prev &&
      prev.anchorId === anchorId &&
      prev.side === side &&
      now - prev.time < DBL_MS
    ) {
      lastHandleClickRef.current = null;
      dragRef.current = null;
      dispatch({ type: "REMOVE_HANDLE", sectionId, anchorId, side });
      return;
    }
    lastHandleClickRef.current = { anchorId, side, time: now };

    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "handle", sectionId, anchorId, side };
  }

  function beginBgMove(e: React.PointerEvent) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "bg-move", last: toContent(e) };
  }

  function beginBgResize(e: React.PointerEvent, corner: BgCorner) {
    if (shouldPan(e)) return startPan(e);
    if (e.button !== 0) return;
    e.stopPropagation();
    suppressClickRef.current = true;
    const bg = state.background;
    if (!bg) return;
    // 잡은 코너의 대각(반대) 코너를 고정점으로 삼는다.
    const fixed = {
      x: corner === "nw" || corner === "sw" ? bg.x + bg.width : bg.x,
      y: corner === "nw" || corner === "ne" ? bg.y + bg.height : bg.y,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "bg-resize", corner, fixed };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pz.updatePan(e)) return;
    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "section") {
        const cur = toSvg(e);
        const dx = cur.x - drag.last.x;
        const dy = cur.y - drag.last.y;
        if (dx || dy) {
          dispatch({ type: "MOVE_SECTION", id: drag.sectionId, dx, dy });
          drag.last = cur;
        }
        return;
      }
      if (drag.kind === "bg-move") {
        const cur = toContent(e);
        const dx = cur.x - drag.last.x;
        const dy = cur.y - drag.last.y;
        if (dx || dy) {
          dispatch({ type: "MOVE_BACKGROUND", dx, dy });
          drag.last = cur;
        }
        return;
      }
      if (drag.kind === "bg-resize") {
        const p = toContent(e);
        const fixed = drag.fixed;
        let w = Math.abs(p.x - fixed.x);
        let h = Math.abs(p.y - fixed.y);
        // Shift: 원본 비율 유지(더 큰 변에 맞춰 보정).
        const bg = state.background;
        if (e.shiftKey && bg && bg.naturalWidth > 0 && bg.naturalHeight > 0) {
          const ar = bg.naturalWidth / bg.naturalHeight;
          if (w / h > ar) h = w / ar;
          else w = h * ar;
        }
        const x = p.x < fixed.x ? fixed.x - w : fixed.x;
        const y = p.y < fixed.y ? fixed.y - h : fixed.y;
        dispatch({ type: "RESIZE_BACKGROUND", x, y, width: w, height: h });
        return;
      }
      if (drag.kind === "handle") {
        dispatch({
          type: "MOVE_HANDLE",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          side: drag.side,
          point: toSvg(e),
        });
      } else {
        dispatch({
          type: "MOVE_ANCHOR",
          sectionId: drag.sectionId,
          anchorId: drag.anchorId,
          point: anchorPoint(e, drag.sectionId, drag.anchorId),
        });
      }
      return;
    }
    if (state.tool === "pen") {
      dispatch({ type: "SET_CURSOR", point: penPoint(e) });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (pz.endPan(e)) return;
    if (dragRef.current) {
      svgRef.current?.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
    // 도형/앵커 조작 직후의 재타게팅된 click 은 무시.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // 펜 도구의 점 찍기/닫기만 click 으로 처리.
    if (state.tool !== "pen") return;
    const p = penPoint(e);
    const closeR = CLOSE_RADIUS / viewRef.current.z;
    if (state.draft.length >= MIN_ANCHORS && dist(p, state.draft[0]) <= closeR) {
      dispatch({ type: "CLOSE_DRAFT" });
    } else {
      dispatch({ type: "ADD_DRAFT_POINT", point: p });
    }
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    // 앵커/핸들/도형의 pointerdown 은 stopPropagation 되므로 여기엔 배경만 도달.
    if (shouldPan(e)) return startPan(e);
    // 배경 클릭: 펜이면 click 에서 점 추가하므로 suppress 해제, 선택이면 선택 해제.
    suppressClickRef.current = false;
    if (state.tool === "select" && e.target === e.currentTarget) {
      dispatch({ type: "SELECT_SECTION", id: null });
    }
  }

  const invZoom = 1 / view.z;
  const canClose = state.draft.length >= MIN_ANCHORS;
  const drawing = state.tool === "pen" && state.draft.length > 0;
  // 도형 바디 상호작용: 선택 도구, 또는 펜 도구이면서 새로 그리는 중이 아닐 때.
  const bodyInteractive =
    state.tool === "select" || (state.tool === "pen" && !drawing);
  const bodyCursor = state.tool === "select" ? "move" : "pointer";

  const svgCursor =
    state.tool === "pan"
      ? pz.panning
        ? "grabbing"
        : "grab"
      : state.tool === "pen"
        ? "crosshair"
        : "default";

  return (
    <MapCanvas
      pz={pz}
      cursor={svgCursor}
      svgProps={{
        onClick: handleClick,
        onPointerDown: handleBackgroundPointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: () => {
          if (state.tool === "pen") dispatch({ type: "SET_CURSOR", point: null });
        },
      }}
    >
      {state.background && (
        <BackgroundLayer
          background={state.background}
          editable={!state.background.locked}
          scale={invZoom}
          onBodyPointerDown={beginBgMove}
          onHandlePointerDown={beginBgResize}
        />
      )}

      {state.sections.map((section) => {
        const selected = state.selectedId === section.id;
        return (
          <SectionShape
            key={section.id}
            section={section}
            selected={bodyInteractive && selected}
            bodyInteractive={bodyInteractive}
            editable={state.tool === "pen" && !drawing && selected}
            scale={invZoom}
            bodyCursor={bodyCursor}
            onSectionPointerDown={beginSectionDrag}
            onAnchorPointerDown={beginAnchorDrag}
            onHandlePointerDown={beginHandleDrag}
          />
        );
      })}

      {state.tool === "pen" && (
        <DraftLayer
          draft={state.draft}
          cursor={state.cursor}
          canClose={canClose}
          scale={invZoom}
        />
      )}
    </MapCanvas>
  );
}
