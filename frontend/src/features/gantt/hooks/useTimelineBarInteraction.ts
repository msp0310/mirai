import { type KeyboardEvent, type MouseEvent, useEffect, useRef } from "react";

import {
  formatShortDate,
  getDateDeltaForTimeUnit,
  getTaskTimelineSpan,
} from "../../../lib/schedule";
import { getMovedTaskDateRange, getResizedTaskDateRange } from "../../../lib/taskOperations";
import type {
  CalendarDefinition,
  GanttTimeUnit,
  TaskRow,
  TimelineDay,
} from "../../../types/schedule";
import { rowHeight } from "../components/constants";
import { buildDependencyPath } from "../lib/timelineGeometry";
import { getTaskSelectionOptions } from "../utils/taskSelection";

type PointerMode = "move" | "start" | "end";

type UseTimelineBarInteractionOptions = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  canMove: boolean;
  canResize: boolean;
  dayWidth: number;
  index: number;
  onFocusTaskStart: () => void;
  onMoveSelectedTasks: (deltaDays: number) => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onOpenInspector: () => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelect: (options?: { additive?: boolean; range?: boolean }) => void;
  selected: boolean;
  selectedTaskCount: number;
  task: TaskRow;
  timeUnit: GanttTimeUnit;
  timeline: TimelineDay[];
};

/** タスクバーの選択、詳細表示、移動、リサイズ、自動スクロールを管理します。 */
export function useTimelineBarInteraction({
  calendar,
  calendarAware,
  canMove,
  canResize,
  dayWidth,
  index,
  onFocusTaskStart,
  onMoveSelectedTasks,
  onMoveTask,
  onOpenInspector,
  onResizeTask,
  onSelect,
  selected,
  selectedTaskCount,
  task,
  timeUnit,
  timeline,
}: UseTimelineBarInteractionOptions) {
  const focusStartTimerRef = useRef<number | null>(null);
  const span = getTaskTimelineSpan(task, timeline);

  useEffect(
    () => () => {
      if (focusStartTimerRef.current !== null) {
        window.clearTimeout(focusStartTimerRef.current);
      }
    },
    [],
  );

  function cancelPendingFocusStart() {
    if (focusStartTimerRef.current === null) {
      return;
    }
    window.clearTimeout(focusStartTimerRef.current);
    focusStartTimerRef.current = null;
  }

  function scheduleFocusStart() {
    cancelPendingFocusStart();
    focusStartTimerRef.current = window.setTimeout(() => {
      focusStartTimerRef.current = null;
      onFocusTaskStart();
    }, 140);
  }

  function startPointerOperation(event: MouseEvent<HTMLElement>, mode: PointerMode) {
    if (event.button !== 0) {
      return;
    }
    if (event.detail >= 2) {
      handleOpenInspector(event);
      return;
    }
    if ((mode === "move" && !canMove) || (mode !== "move" && !canResize)) {
      return;
    }
    const selectionOptions = getTaskSelectionOptions(event);
    const moveSelectionTogether =
      mode === "move" &&
      selected &&
      selectedTaskCount > 1 &&
      !selectionOptions.additive &&
      !selectionOptions.range;
    onSelect(selectionOptions);
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget.closest(".gantt-bar, .milestone") as HTMLElement | null;
    if (!element) {
      return;
    }
    const canvas = element.closest(".timeline-canvas") as HTMLElement | null;
    const body = element.closest(".timeline-body") as HTMLElement | null;
    let previewElements: ReturnType<typeof ensureDragPreviewElements> | null = null;
    let autoScrollFrame: number | null = null;
    let active = false;
    const startX = event.clientX;
    const startScrollLeft = body?.scrollLeft ?? 0;
    let latestClientX = startX;
    let latestDelta = 0;
    const minWidth = Math.max(dayWidth - 12, 10);
    const maxStartDelta = Math.max(span.duration - 1, 0);
    const minEndDelta = -Math.max(span.duration - 1, 0);

    const getPreviewState = (deltaUnits: number) => {
      const deltaDays = getDateDeltaForTimeUnit(
        mode === "end" ? task.end : task.start,
        timeUnit,
        deltaUnits,
      );
      const range =
        mode === "move"
          ? getMovedTaskDateRange(task, deltaDays, calendar, calendarAware)
          : getResizedTaskDateRange(task, mode, deltaDays);
      const previewSpan = getTaskTimelineSpan({ ...task, ...range }, timeline);
      const startOffsetPx = (previewSpan.offset - span.offset) * dayWidth;
      const endOffsetPx =
        (previewSpan.offset + previewSpan.duration - (span.offset + span.duration)) * dayWidth;
      const lineSlot =
        mode === "end" ? previewSpan.offset + previewSpan.duration : previewSpan.offset;
      return {
        endOffsetPx,
        lineSlot,
        range,
        startOffsetPx,
        width: Math.max(previewSpan.duration * dayWidth - 12, minWidth),
      };
    };

    const updatePreview = (deltaUnits: number, preview: ReturnType<typeof getPreviewState>) => {
      const { endOffsetPx, lineSlot, range, startOffsetPx } = preview;
      const lineLeft = clamp(lineSlot, 0, timeline.length) * dayWidth;
      const previewLabel = formatDragPreviewLabel(mode, deltaUnits, timeUnit, range);
      const label = moveSelectionTogether
        ? `${selectedTaskCount}件・${previewLabel}`
        : previewLabel;

      element.dataset.dragPreview = label;
      if (!previewElements) {
        return;
      }
      previewElements.guide.style.left = `${lineLeft}px`;
      previewElements.bubble.style.left = `${lineLeft}px`;
      previewElements.bubble.style.top = `${Math.max(index * rowHeight - 32, 4)}px`;
      previewElements.bubble.textContent = label;
      updateDependencyPreviewPaths(canvas, task.id, startOffsetPx, endOffsetPx);
    };

    const beginDrag = () => {
      if (active) {
        return;
      }
      active = true;
      element.classList.add("is-dragging");
      previewElements = canvas ? ensureDragPreviewElements(canvas) : null;
      updatePreview(0, getPreviewState(0));
    };

    const cleanup = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      window.removeEventListener("keydown", handleCancel);
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
      if (body) {
        delete body.dataset.autoScroll;
      }
      element.classList.remove("is-dragging");
      element.style.transform = "";
      element.style.width = "";
      delete element.dataset.dragPreview;
      resetDependencyPreviewPaths(canvas);
      clearDragPreviewElements(canvas);
    };

    const applyPointerPosition = (clientX: number) => {
      const scrollDelta = (body?.scrollLeft ?? startScrollLeft) - startScrollLeft;
      const rawDelta = clientX - startX + scrollDelta;
      if (!active && Math.abs(rawDelta) < 5) {
        return;
      }
      beginDrag();
      let deltaUnits = Math.round(rawDelta / dayWidth);
      if (mode === "start") {
        deltaUnits = Math.min(deltaUnits, maxStartDelta);
      }
      if (mode === "end") {
        deltaUnits = Math.max(deltaUnits, minEndDelta);
      }
      if (deltaUnits === latestDelta) {
        return;
      }
      latestDelta = deltaUnits;
      const preview = getPreviewState(latestDelta);
      if (mode === "move" || mode === "start") {
        element.style.transform = `translate3d(${preview.startOffsetPx}px, 0, 0)`;
      }
      element.style.width = `${preview.width}px`;
      updatePreview(latestDelta, preview);
    };

    const getAutoScrollVelocity = () => {
      if (!active || !body) {
        return 0;
      }
      const rect = body.getBoundingClientRect();
      const edgeSize = Math.min(56, rect.width * 0.16);
      if (latestClientX < rect.left + edgeSize) {
        return -Math.ceil(((rect.left + edgeSize - latestClientX) / edgeSize) * 14);
      }
      if (latestClientX > rect.right - edgeSize) {
        return Math.ceil(((latestClientX - (rect.right - edgeSize)) / edgeSize) * 14);
      }
      return 0;
    };

    const runAutoScroll = () => {
      autoScrollFrame = null;
      if (!body) {
        return;
      }
      const velocity = getAutoScrollVelocity();
      if (velocity === 0) {
        return;
      }
      const previousScrollLeft = body.scrollLeft;
      body.scrollLeft += velocity;
      if (body.scrollLeft === previousScrollLeft) {
        return;
      }
      applyPointerPosition(latestClientX);
      autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = () => {
      const velocity = getAutoScrollVelocity();
      if (body) {
        if (velocity < 0) {
          body.dataset.autoScroll = "left";
        } else if (velocity > 0) {
          body.dataset.autoScroll = "right";
        } else {
          delete body.dataset.autoScroll;
        }
      }
      if (velocity !== 0 && autoScrollFrame === null) {
        autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
      } else if (velocity === 0 && autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
    };

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      latestClientX = moveEvent.clientX;
      applyPointerPosition(latestClientX);
      updateAutoScroll();
    };
    const suppressFollowingClick = () => {
      element.dataset.suppressTaskClick = "true";
      window.setTimeout(() => delete element.dataset.suppressTaskClick, 0);
    };
    const handleUp = () => {
      const didDrag = active;
      cleanup();
      if (didDrag) {
        suppressFollowingClick();
      }
      if (!didDrag || latestDelta === 0) {
        return;
      }
      if (mode === "move") {
        const deltaDays = getDateDeltaForTimeUnit(task.start, timeUnit, latestDelta);
        if (moveSelectionTogether) {
          onMoveSelectedTasks(deltaDays);
        } else {
          onMoveTask(task.id, deltaDays);
        }
      } else {
        onResizeTask(
          task.id,
          mode,
          getDateDeltaForTimeUnit(mode === "end" ? task.end : task.start, timeUnit, latestDelta),
        );
      }
    };
    const handleCancel = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key !== "Escape") {
        return;
      }
      keyEvent.preventDefault();
      suppressFollowingClick();
      cleanup();
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    window.addEventListener("keydown", handleCancel);
  }

  function handleOpenInspector(event: MouseEvent<HTMLElement>) {
    cancelPendingFocusStart();
    event.preventDefault();
    event.stopPropagation();
    onSelect(getTaskSelectionOptions(event));
    onOpenInspector();
  }

  function handleTaskClick(event: MouseEvent<HTMLElement>) {
    if (event.currentTarget.dataset.suppressTaskClick === "true") {
      return;
    }
    const selectionOptions = getTaskSelectionOptions(event);
    onSelect(selectionOptions);
    if (!selectionOptions.additive && !selectionOptions.range && event.detail === 1) {
      scheduleFocusStart();
    }
    if (event.detail >= 2) {
      handleOpenInspector(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    if (event.shiftKey && canResize) {
      onResizeTask(task.id, "end", getDateDeltaForTimeUnit(task.end, timeUnit, delta));
    } else if (canMove) {
      onMoveTask(task.id, getDateDeltaForTimeUnit(task.start, timeUnit, delta));
    }
  }

  return { handleKeyDown, handleOpenInspector, handleTaskClick, startPointerOperation };
}

function updateDependencyPreviewPaths(
  canvas: HTMLElement | null,
  taskId: string,
  startOffsetPx: number,
  endOffsetPx: number,
) {
  if (!canvas) {
    return;
  }
  const paths = canvas.querySelectorAll<SVGPathElement>(
    ".dependency-overlay path[data-dependency-source-id], .dependency-overlay path[data-dependency-target-id]",
  );

  paths.forEach((path) => {
    const sourceX = Number(path.dataset.sourceX);
    const sourceY = Number(path.dataset.sourceY);
    const targetX = Number(path.dataset.targetX);
    const targetY = Number(path.dataset.targetY);
    if (
      Number.isNaN(sourceX) ||
      Number.isNaN(sourceY) ||
      Number.isNaN(targetX) ||
      Number.isNaN(targetY)
    ) {
      return;
    }

    let nextSourceX = sourceX;
    let nextTargetX = targetX;
    if (path.dataset.dependencySourceId === taskId) {
      nextSourceX += endOffsetPx;
    }
    if (path.dataset.dependencyTargetId === taskId) {
      nextTargetX += startOffsetPx;
    }

    path.setAttribute("d", buildDependencyPath(nextSourceX, sourceY, nextTargetX, targetY));
  });
}

function resetDependencyPreviewPaths(canvas: HTMLElement | null) {
  if (!canvas) {
    return;
  }
  const paths = canvas.querySelectorAll<SVGPathElement>(
    ".dependency-overlay path[data-source-x][data-source-y][data-target-x][data-target-y]",
  );

  paths.forEach((path) => {
    const sourceX = Number(path.dataset.sourceX);
    const sourceY = Number(path.dataset.sourceY);
    const targetX = Number(path.dataset.targetX);
    const targetY = Number(path.dataset.targetY);
    if (
      Number.isNaN(sourceX) ||
      Number.isNaN(sourceY) ||
      Number.isNaN(targetX) ||
      Number.isNaN(targetY)
    ) {
      return;
    }
    path.setAttribute("d", buildDependencyPath(sourceX, sourceY, targetX, targetY));
  });
}

function ensureDragPreviewElements(canvas: HTMLElement) {
  const guide = document.createElement("div");
  guide.className = "drag-snap-guide";
  guide.dataset.dragPreviewGuide = "true";
  const bubble = document.createElement("div");
  bubble.className = "drag-preview-bubble";
  bubble.dataset.dragPreviewBubble = "true";
  canvas.append(guide, bubble);
  return { bubble, guide };
}

function clearDragPreviewElements(canvas: HTMLElement | null) {
  if (!canvas) {
    return;
  }
  canvas
    .querySelectorAll("[data-drag-preview-guide], [data-drag-preview-bubble]")
    .forEach((element) => element.remove());
}

function formatDragPreviewLabel(
  mode: PointerMode,
  deltaUnits: number,
  timeUnit: GanttTimeUnit,
  range: { end: string; start: string },
): string {
  const modeLabel = mode === "move" ? "移動" : mode === "start" ? "開始変更" : "終了変更";
  const unitLabel = timeUnit === "month" ? "か月" : timeUnit === "week" ? "週" : "日";
  const deltaLabel =
    deltaUnits === 0 ? "変更なし" : `${deltaUnits > 0 ? "+" : ""}${deltaUnits}${unitLabel}`;
  const rangeLabel =
    range.start === range.end
      ? formatShortDate(range.start)
      : `${formatShortDate(range.start)} - ${formatShortDate(range.end)}`;
  return `${modeLabel} ${deltaLabel} / ${rangeLabel}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
