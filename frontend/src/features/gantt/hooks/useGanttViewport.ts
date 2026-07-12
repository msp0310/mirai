import { useCallback, useEffect, useRef, useState } from "react";

import { getTimelineSlotIndex } from "../../../lib/schedule";
import type { GanttTimeUnit, ScheduleTask, TaskRow, TimelineDay } from "../../../types/schedule";
import { rowHeight, todayKey } from "../components/constants";

type UseGanttViewportOptions = {
  dayWidth: number;
  displayRows: TaskRow[];
  onInteractionStart: () => void;
  projectRangeEnd: string;
  projectRangeStart: string;
  selectedTaskId: string | null;
  tasks: ScheduleTask[];
  taskStartFocusSignal: number;
  timeline: TimelineDay[];
  timeUnit: GanttTimeUnit;
  todaySignal: number;
};

/** 表とタイムラインのスクロール同期、および日付へのフォーカス移動を管理します。 */
export function useGanttViewport({
  dayWidth,
  displayRows,
  onInteractionStart,
  projectRangeEnd,
  projectRangeStart,
  selectedTaskId,
  tasks,
  taskStartFocusSignal,
  timeline,
  timeUnit,
  todaySignal,
}: UseGanttViewportOptions) {
  const tableRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);

  const setSynchronizedScrollTop = useCallback((nextScrollTop: number) => {
    if (tableRef.current) {
      tableRef.current.scrollTop = nextScrollTop;
    }
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = nextScrollTop;
    }
    setScrollTop(nextScrollTop);
  }, []);

  const scrollTimelineToLeft = useCallback((left: number) => {
    const body = timelineBodyRef.current;
    if (!body) {
      return;
    }
    const maxScrollLeft = Math.max(body.scrollWidth - body.clientWidth, 0);
    const nextScrollLeft = Math.min(Math.max(left, 0), maxScrollLeft);
    body.scrollLeft = nextScrollLeft;
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = body.scrollLeft;
    }
    setScrollLeft(body.scrollLeft);
  }, []);

  const scrollTimelineToSlot = useCallback(
    (slotIndex: number, align = 0.52) => {
      const body = timelineBodyRef.current;
      if (!body) {
        return;
      }
      scrollTimelineToLeft(slotIndex * dayWidth - body.clientWidth * align);
    },
    [dayWidth, scrollTimelineToLeft],
  );

  const focusTimelineTaskStart = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      scrollTimelineToSlot(getTimelineSlotIndex(task.start, timeline), 0.14);
    },
    [scrollTimelineToSlot, tasks, timeline],
  );

  const handleTimelineNavigate = useCallback(
    (direction: -1 | 1) => {
      const body = timelineBodyRef.current;
      if (!body) {
        return;
      }
      const periodStepSlots = timeUnit === "day" ? 30 : timeUnit === "week" ? 4 : 1;
      const pageStep = Math.max(dayWidth * periodStepSlots, dayWidth);
      scrollTimelineToLeft(body.scrollLeft + pageStep * direction);
    },
    [dayWidth, scrollTimelineToLeft, timeUnit],
  );

  const handleTimelineScroll = useCallback(() => {
    onInteractionStart();
    const body = timelineBodyRef.current;
    if (!body || syncingRef.current) {
      return;
    }
    setScrollTop(body.scrollTop);
    setScrollLeft(body.scrollLeft);
    syncingRef.current = true;
    if (tableRef.current) {
      tableRef.current.scrollTop = body.scrollTop;
    }
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = body.scrollLeft;
    }
    syncingRef.current = false;
  }, [onInteractionStart]);

  const handleTableScroll = useCallback(() => {
    onInteractionStart();
    const table = tableRef.current;
    if (!table || syncingRef.current) {
      return;
    }
    setScrollTop(table.scrollTop);
    syncingRef.current = true;
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = table.scrollTop;
    }
    syncingRef.current = false;
  }, [onInteractionStart]);

  useEffect(() => {
    function measureViewport() {
      const timelineBody = timelineBodyRef.current;
      setViewportHeight(timelineBody?.clientHeight ?? tableRef.current?.clientHeight ?? 0);
      setTimelineViewportWidth(timelineBody?.clientWidth ?? 0);
      setScrollLeft(timelineBody?.scrollLeft ?? 0);
    }

    measureViewport();
    const timelineBody = timelineBodyRef.current;
    const table = tableRef.current;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureViewport);
      return () => window.removeEventListener("resize", measureViewport);
    }

    const observer = new ResizeObserver(measureViewport);
    if (timelineBody) {
      observer.observe(timelineBody);
    }
    if (table) {
      observer.observe(table);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selectedIndex = displayRows.findIndex((row) => row.id === selectedTaskId);
    if (selectedIndex === -1) {
      return;
    }
    const scrollContainer = timelineBodyRef.current ?? tableRef.current;
    if (!scrollContainer) {
      return;
    }
    const rowTop = selectedIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const currentTop = scrollContainer.scrollTop;
    const currentBottom = currentTop + scrollContainer.clientHeight;
    if (rowTop >= currentTop && rowBottom <= currentBottom) {
      return;
    }
    setSynchronizedScrollTop(Math.max(rowTop - rowHeight * 2, 0));
  }, [displayRows, selectedTaskId, setSynchronizedScrollTop]);

  useEffect(() => {
    scrollTimelineToSlot(getTimelineSlotIndex(todayKey, timeline));
  }, [projectRangeEnd, projectRangeStart, scrollTimelineToSlot, timeline, todaySignal]);

  useEffect(() => {
    if (taskStartFocusSignal === 0 || !selectedTaskId) {
      return;
    }
    const task = tasks.find((item) => item.id === selectedTaskId);
    if (task) {
      scrollTimelineToSlot(getTimelineSlotIndex(task.start, timeline), 0.18);
    }
  }, [selectedTaskId, scrollTimelineToSlot, taskStartFocusSignal, tasks, timeline]);

  return {
    focusTimelineTaskStart,
    handleTableScroll,
    handleTimelineNavigate,
    handleTimelineScroll,
    scrollLeft,
    scrollTop,
    setSynchronizedScrollTop,
    tableRef,
    timelineBodyRef,
    timelineHeaderRef,
    timelineViewportWidth,
    viewportHeight,
  };
}
