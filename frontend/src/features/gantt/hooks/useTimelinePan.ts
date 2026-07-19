import { type PointerEvent as ReactPointerEvent, useCallback, useRef } from "react";

type TimelinePanSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  dragging: boolean;
};

const interactiveTimelineSelector = [
  ".gantt-bar",
  ".milestone",
  ".resize-handle",
  ".gantt-out-of-range-guide",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
].join(", ");

/** タスクがない時間軸を掴み、表と同期したまま縦横スクロールします。 */
export function useTimelinePan() {
  const sessionRef = useRef<TimelinePanSession | null>(null);

  const finishPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const body = event.currentTarget;
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    sessionRef.current = null;
    delete body.dataset.panning;
    if (body.hasPointerCapture(event.pointerId)) {
      body.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      event.button !== 0 ||
      event.pointerType === "touch" ||
      !(target instanceof Element) ||
      target.closest(interactiveTimelineSelector)
    ) {
      return;
    }

    const body = event.currentTarget;
    sessionRef.current = {
      dragging: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: body.scrollLeft,
      startScrollTop: body.scrollTop,
    };
    body.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - session.startClientX;
    const deltaY = event.clientY - session.startClientY;
    if (!session.dragging && Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    const body = event.currentTarget;
    session.dragging = true;
    body.dataset.panning = "true";
    body.scrollLeft = session.startScrollLeft - deltaX;
    body.scrollTop = session.startScrollTop - deltaY;
    event.preventDefault();
  }, []);

  return {
    onLostPointerCapture: finishPan,
    onPointerCancel: finishPan,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishPan,
  };
}
