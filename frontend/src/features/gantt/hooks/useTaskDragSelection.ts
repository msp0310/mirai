import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TaskRow } from "../../../types/schedule";
import { rowHeight } from "../components/constants";

type DragSelectionState = {
  anchorIndex: number;
  currentIndex: number;
};

type DragSelectionSession = {
  active: boolean;
  anchorIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type UseTaskDragSelectionOptions = {
  displayRows: TaskRow[];
  onInteractionStart: () => void;
  onSelectTaskRange: (startTaskId: string, endTaskId: string) => void;
  suppressNextClick: () => void;
  tableRef: RefObject<HTMLDivElement | null>;
};

/** 空白領域からのドラッグ範囲選択と選択ガイドを管理します。 */
export function useTaskDragSelection({
  displayRows,
  onInteractionStart,
  onSelectTaskRange,
  suppressNextClick,
  tableRef,
}: UseTaskDragSelectionOptions) {
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const sessionRef = useRef<DragSelectionSession | null>(null);
  const listenersRef = useRef<AbortController | null>(null);

  const clearDragSelection = useCallback(() => setDragSelection(null), []);
  const dragSelectionBox = useMemo(() => {
    if (!dragSelection) {
      return null;
    }
    const start = Math.min(dragSelection.anchorIndex, dragSelection.currentIndex);
    const end = Math.max(dragSelection.anchorIndex, dragSelection.currentIndex);
    return {
      height: (end - start + 1) * rowHeight,
      top: start * rowHeight,
    };
  }, [dragSelection]);

  const getTaskIndexFromClientY = useCallback(
    (clientY: number) => {
      const table = tableRef.current;
      if (!table || displayRows.length === 0) {
        return -1;
      }
      const y = clientY - table.getBoundingClientRect().top + table.scrollTop;
      return Math.min(Math.max(Math.floor(y / rowHeight), 0), displayRows.length - 1);
    },
    [displayRows.length, tableRef],
  );

  const selectRangeByIndex = useCallback(
    (anchorIndex: number, currentIndex: number) => {
      const anchorTask = displayRows[anchorIndex];
      const currentTask = displayRows[currentIndex];
      if (anchorTask && currentTask) {
        onSelectTaskRange(anchorTask.id, currentTask.id);
      }
    },
    [displayRows, onSelectTaskRange],
  );

  const handleTablePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDragSelectionBlocked(event.target)) {
        return;
      }
      const anchorIndex = getTaskIndexFromClientY(event.clientY);
      if (anchorIndex < 0) {
        return;
      }

      onInteractionStart();
      sessionRef.current = {
        active: false,
        anchorIndex,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      listenersRef.current?.abort();
      const listeners = new AbortController();
      listenersRef.current = listeners;

      function handlePointerMove(pointerEvent: PointerEvent) {
        const session = sessionRef.current;
        if (!session || pointerEvent.pointerId !== session.pointerId) {
          return;
        }
        const currentIndex = getTaskIndexFromClientY(pointerEvent.clientY);
        if (currentIndex < 0) {
          return;
        }
        const distance = Math.hypot(
          pointerEvent.clientX - session.startX,
          pointerEvent.clientY - session.startY,
        );
        if (!session.active && distance < 5) {
          return;
        }
        if (!session.active) {
          session.active = true;
          window.getSelection()?.removeAllRanges();
        }
        pointerEvent.preventDefault();
        setDragSelection({ anchorIndex: session.anchorIndex, currentIndex });
        selectRangeByIndex(session.anchorIndex, currentIndex);
      }

      function handlePointerEnd(pointerEvent: PointerEvent) {
        const session = sessionRef.current;
        if (!session || pointerEvent.pointerId !== session.pointerId) {
          return;
        }
        listeners.abort();
        if (session.active) {
          const currentIndex = getTaskIndexFromClientY(pointerEvent.clientY);
          if (currentIndex >= 0) {
            selectRangeByIndex(session.anchorIndex, currentIndex);
          }
          suppressNextClick();
        }
        sessionRef.current = null;
        setDragSelection(null);
      }

      document.addEventListener("pointermove", handlePointerMove, { signal: listeners.signal });
      document.addEventListener("pointerup", handlePointerEnd, { signal: listeners.signal });
      document.addEventListener("pointercancel", handlePointerEnd, { signal: listeners.signal });
    },
    [getTaskIndexFromClientY, onInteractionStart, selectRangeByIndex, suppressNextClick],
  );

  useEffect(
    () => () => {
      listenersRef.current?.abort();
    },
    [],
  );

  return { clearDragSelection, dragSelectionBox, handleTablePointerDown };
}

function isDragSelectionBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "select",
        "textarea",
        "a",
        "[contenteditable='true']",
        ".collapse-button",
        ".dependency-alert-badge",
        ".inline-select",
        ".inline-title-input",
        ".task-context-menu",
      ].join(", "),
    ),
  );
}
