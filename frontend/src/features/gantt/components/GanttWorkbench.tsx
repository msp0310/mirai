import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  Member,
  ScheduleTask,
  ScheduleFilters,
  TaskInspectorFocusTarget,
  TaskRow,
  TaskStatus,
  TimelineColumn,
  TimelineDay,
} from "../../../types/schedule";
import type { TaskSiblingReorderPlacement } from "../../../lib/taskOperations";
import type { DependencyIssue } from "../../../lib/schedule";
import { getDependencyIssues, getTimelineSlotIndex, statusLabels } from "../../../lib/schedule";
import { getActiveMembers } from "../../../lib/members";
import { rowHeight, todayKey } from "./constants";
import { FilterPanel } from "./FilterPanel";
import { GanttToolbar } from "./GanttToolbar";
import { TaskTableHeader, type TaskTableSortKey, type TaskTableSortState } from "./TaskTableHeader";
import { TaskTableRow } from "./TaskTableRow";
import { TimelineGrid } from "./TimelineGrid";

type GanttWorkbenchProps = {
  activeFilterCount: number;
  calendarAware: boolean;
  canPasteTask: boolean;
  canEditPlan?: boolean;
  columnVisibility: GanttColumnVisibility;
  collapsedIds: Set<string>;
  filterOpen: boolean;
  filters: ScheduleFilters;
  members: Member[];
  onBulkAssigneeChange: (memberId: string, taskId?: string | null) => void;
  onBulkDateShift: (deltaDays: number, taskId?: string | null) => void;
  onBulkStatusChange: (status: TaskStatus, taskId?: string | null) => void;
  months: TimelineColumn[];
  onAssigneeChange: (assigneeId: string) => void;
  onCalendarAwareChange: (enabled: boolean) => void;
  onColumnVisibilityChange: (visibility: GanttColumnVisibility) => void;
  onCopyTask: (taskId?: string | null) => void;
  onClearSelection: () => void;
  onCreateTask: () => void;
  onDeleteTask: (taskId?: string | null) => void;
  onDuplicateTask: (taskId?: string | null) => void;
  onFilterOpenChange: (open: boolean) => void;
  onFilterReset: () => void;
  onIndentTasks: () => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onOpenTaskInspector: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  onReorderTasks: (direction: -1 | 1, taskId?: string | null) => void;
  onReorderTasksToTarget: (
    targetTaskId: string,
    placement: TaskSiblingReorderPlacement,
    taskIds: string[],
  ) => void;
  onReparentTasksByDrag: (
    targetParentId: string | null,
    taskIds: string[],
    referenceTaskId?: string | null,
    placement?: TaskSiblingReorderPlacement,
  ) => void;
  onOutdentTasks: () => void;
  onPasteTask: (taskId?: string | null) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onScaleChange: (scale: GanttScale) => void;
  onShortcutHelp: () => void;
  onSelectTask: (
    taskId: string,
    options?: {
      additive?: boolean;
      focusTarget?: TaskInspectorFocusTarget;
      range?: boolean;
    },
  ) => void;
  onSelectTaskRange: (startTaskId: string, endTaskId: string) => void;
  onStatusToggle: (status: TaskStatus) => void;
  onTimeUnitChange: (unit: GanttTimeUnit) => void;
  onToday: () => void;
  onToggleCollapsed: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  rows: TaskRow[];
  scale: GanttScale;
  selectedTaskCount: number;
  selectedTaskId: string | null;
  selectedTaskIds: Set<string>;
  tasks: ScheduleTask[];
  taskStartFocusSignal: number;
  taskTitleEditRequest: { requestId: number; taskId: string | null };
  timeUnit: GanttTimeUnit;
  displayMode: "gantt" | "table";
  onDisplayModeChange: (mode: "gantt" | "table") => void;
  timeline: TimelineDay[];
  todaySignal: number;
  weeks: TimelineColumn[];
};

type TaskContextMenuState = {
  taskId: string;
  x: number;
  y: number;
};

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

type RowReorderState = {
  draggingTaskIds: string[];
  mode: "child" | "outdent" | "sibling";
  placement: TaskSiblingReorderPlacement;
  referenceTaskId: string | null;
  reason: string;
  sourceTaskId: string;
  targetParentId: string | null;
  targetTaskId: string | null;
  valid: boolean;
};

type RowReorderSession = {
  active: boolean;
  draggingTaskIds: string[];
  pointerId: number;
  sourceTaskId: string;
  startX: number;
  startY: number;
};

function sortTaskRowsPreservingHierarchy(
  rows: TaskRow[],
  sort: TaskTableSortState,
  members: Member[],
) {
  if (!sort.key || rows.length < 2) return rows;

  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const statusOrder: Record<TaskStatus, number> = {
    notStarted: 0,
    inProgress: 1,
    delayed: 2,
    done: 3,
  };

  function compare(left: TaskRow, right: TaskRow) {
    let result = 0;
    if (sort.key === "title") {
      result = left.title.localeCompare(right.title, "ja");
    } else if (sort.key === "start") {
      result = left.start.localeCompare(right.start) || left.end.localeCompare(right.end);
    } else if (sort.key === "end") {
      result = left.end.localeCompare(right.end) || left.start.localeCompare(right.start);
    } else if (sort.key === "assignee") {
      const leftAssignee = memberNames.get(left.assigneeIds[0] ?? "") ?? "未割当";
      const rightAssignee = memberNames.get(right.assigneeIds[0] ?? "") ?? "未割当";
      result = leftAssignee.localeCompare(rightAssignee, "ja");
    } else if (sort.key === "status") {
      result = statusOrder[left.status] - statusOrder[right.status];
    } else {
      result = left.progress - right.progress;
    }
    return (sort.direction === "asc" ? result : -result) || left.id.localeCompare(right.id);
  }

  function sortLevel(startIndex: number, depth: number): { nextIndex: number; rows: TaskRow[] } {
    const blocks: Array<{ root: TaskRow; rows: TaskRow[] }> = [];
    let index = startIndex;
    while (index < rows.length && rows[index]?.depth === depth) {
      const root = rows[index];
      if (!root) break;
      index += 1;
      const children = sortLevel(index, depth + 1);
      index = children.nextIndex;
      blocks.push({ root, rows: [root, ...children.rows] });
    }
    blocks.sort((left, right) => compare(left.root, right.root));
    return {
      nextIndex: index,
      rows: blocks.flatMap((block) => block.rows),
    };
  }

  return sortLevel(0, rows[0]?.depth ?? 0).rows;
}

/** 大量のタスクを編集・選択・移動できるガントワークベンチです。 */
export function GanttWorkbench({
  activeFilterCount,
  calendarAware,
  canPasteTask,
  canEditPlan = true,
  columnVisibility,
  collapsedIds,
  filterOpen,
  filters,
  members,
  onBulkAssigneeChange,
  onBulkDateShift,
  onBulkStatusChange,
  months,
  onAssigneeChange,
  onCalendarAwareChange,
  onColumnVisibilityChange,
  onClearSelection,
  onCopyTask,
  onCreateTask,
  onDeleteTask,
  onDuplicateTask,
  onFilterOpenChange,
  onFilterReset,
  onIndentTasks,
  onMoveTask,
  onOpenTaskInspector,
  onReorderTasks,
  onReorderTasksToTarget,
  onReparentTasksByDrag,
  onOutdentTasks,
  onPasteTask,
  onResizeTask,
  onScaleChange,
  onShortcutHelp,
  onSelectTask,
  onSelectTaskRange,
  onStatusToggle,
  onTimeUnitChange,
  onToday,
  onToggleCollapsed,
  onUpdateTask,
  rows,
  scale,
  selectedTaskCount,
  selectedTaskId,
  selectedTaskIds,
  tasks,
  taskStartFocusSignal,
  taskTitleEditRequest,
  timeUnit,
  displayMode,
  onDisplayModeChange,
  timeline,
  todaySignal,
  weeks,
}: GanttWorkbenchProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
  const taskContextMenuRef = useRef<HTMLDivElement>(null);
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const dragSelectionSessionRef = useRef<DragSelectionSession | null>(null);
  const [rowReorder, setRowReorder] = useState<RowReorderState | null>(null);
  const rowReorderSessionRef = useRef<RowReorderSession | null>(null);
  const suppressDragClickRef = useRef(false);
  const [tableSort, setTableSort] = useState<TaskTableSortState>({
    direction: "asc",
    key: null,
  });
  const dependencyIssueByTaskId = useMemo(() => {
    const issuesByTaskId = new Map<string, DependencyIssue[]>();
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    rows.forEach((task) => {
      const issues = getDependencyIssues(task, taskById);
      if (issues.length > 0) {
        issuesByTaskId.set(task.id, issues);
      }
    });
    return issuesByTaskId;
  }, [rows, tasks]);
  const taskChildrenByParentId = useMemo(() => {
    const children = new Map<string, ScheduleTask[]>();
    tasks.forEach((task) => {
      if (!task.parentId) return;
      const siblings = children.get(task.parentId) ?? [];
      siblings.push(task);
      children.set(task.parentId, siblings);
    });
    return children;
  }, [tasks]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const displayRows = useMemo(
    () =>
      displayMode === "table" ? sortTaskRowsPreservingHierarchy(rows, tableSort, members) : rows,
    [displayMode, members, rows, tableSort],
  );
  const taskTableColumns = useMemo(
    () =>
      (displayMode === "table"
        ? ["280px", "110px", "110px", "220px", columnVisibility.status ? "86px" : null, "100px"]
        : [
            "minmax(280px, 1fr)",
            columnVisibility.assignee ? "72px" : null,
            columnVisibility.status ? "68px" : null,
            columnVisibility.progress ? "56px" : null,
          ]
      )
        .filter(Boolean)
        .join(" "),
    [columnVisibility, displayMode],
  );
  const dayWidth = useMemo(() => {
    const widths: Record<GanttTimeUnit, Record<GanttScale, number>> = {
      day: { compact: 16, normal: 22, comfortable: 30 },
      week: { compact: 54, normal: 72, comfortable: 92 },
      month: { compact: 88, normal: 116, comfortable: 148 },
    };
    return widths[timeUnit][scale];
  }, [scale, timeUnit]);
  const virtualWindow = useMemo(() => {
    const overscan = 8;
    const measuredHeight = viewportHeight || 580;
    const start = Math.max(Math.floor(scrollTop / rowHeight) - overscan, 0);
    const end = Math.min(
      displayRows.length,
      Math.ceil((scrollTop + measuredHeight) / rowHeight) + overscan,
    );
    return {
      rows: displayRows.slice(start, end),
      start,
      topSpacer: start * rowHeight,
      totalHeight: displayRows.length * rowHeight,
    };
  }, [displayRows, scrollTop, viewportHeight]);
  const visibleSlotWindow = useMemo(() => {
    const measuredWidth = timelineViewportWidth || 980;
    const overscan = timeUnit === "day" ? Math.ceil(360 / dayWidth) : 4;
    const start = Math.max(Math.floor(scrollLeft / dayWidth) - overscan, 0);
    const end = Math.min(
      timeline.length,
      Math.ceil((scrollLeft + measuredWidth) / dayWidth) + overscan,
    );
    return {
      end,
      start,
    };
  }, [dayWidth, scrollLeft, timeline.length, timelineViewportWidth, timeUnit]);
  const dragSelectionBox = useMemo(() => {
    if (!dragSelection) return null;
    const start = Math.min(dragSelection.anchorIndex, dragSelection.currentIndex);
    const end = Math.max(dragSelection.anchorIndex, dragSelection.currentIndex);
    return {
      height: (end - start + 1) * rowHeight,
      top: start * rowHeight,
    };
  }, [dragSelection]);
  const rowReorderGuide = useMemo(() => {
    if (!rowReorder?.targetTaskId) return null;
    const guideTaskId =
      rowReorder.mode === "outdent" ? rowReorder.referenceTaskId : rowReorder.targetTaskId;
    const targetIndex = displayRows.findIndex((row) => row.id === guideTaskId);
    if (targetIndex < 0) return null;
    const targetRow = displayRows[targetIndex];
    let guideIndex = targetIndex;
    if (targetRow && (rowReorder.mode === "child" || rowReorder.mode === "outdent")) {
      guideIndex = getVisibleSubtreeEndIndex(targetIndex);
    }
    return {
      label: rowReorder.valid
        ? rowReorder.mode === "child"
          ? "子階層へ入れる"
          : rowReorder.mode === "outdent"
            ? "親階層へ出す"
            : "ここへ移動"
        : rowReorder.reason,
      top: (rowReorder.placement === "after" ? guideIndex + 1 : guideIndex) * rowHeight,
      valid: rowReorder.valid,
    };
  }, [displayRows, rowReorder]);
  const assigneeOptions = useMemo(() => {
    const activeMembers = getActiveMembers(members);
    return activeMembers.length > 0 ? activeMembers : members;
  }, [members]);

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
    if (timelineBody) observer.observe(timelineBody);
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selectedIndex = displayRows.findIndex((row) => row.id === selectedTaskId);
    if (selectedIndex < 0) return;
    const body = timelineBodyRef.current;
    const table = tableRef.current;
    const scrollContainer = body ?? table;
    if (!scrollContainer) return;
    const rowTop = selectedIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const currentTop = scrollContainer.scrollTop;
    const currentBottom = currentTop + scrollContainer.clientHeight;
    if (rowTop >= currentTop && rowBottom <= currentBottom) return;
    const nextTop = Math.max(rowTop - rowHeight * 2, 0);
    if (body) body.scrollTop = nextTop;
    if (table) table.scrollTop = nextTop;
    setScrollTop(nextTop);
  }, [displayRows, selectedTaskId]);

  useEffect(() => {
    const offset = getTimelineSlotIndex(todayKey, timeline);
    scrollTimelineToSlot(offset);
  }, [dayWidth, timeline, todaySignal]);

  useEffect(() => {
    if (taskStartFocusSignal === 0 || !selectedTaskId) return;
    const task = tasks.find((item) => item.id === selectedTaskId);
    if (!task) return;
    const offset = getTimelineSlotIndex(task.start, timeline);
    scrollTimelineToSlot(offset, 0.18);
  }, [dayWidth, selectedTaskId, taskStartFocusSignal, tasks, timeline]);

  useEffect(() => {
    if (!taskContextMenu) return;

    function closeWhenOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !taskContextMenuRef.current?.contains(target)) {
        setTaskContextMenu(null);
      }
    }

    function closeWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTaskContextMenu(null);
      }
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [taskContextMenu]);

  function handleTimelineScroll() {
    closeContextMenu();
    const body = timelineBodyRef.current;
    if (!body || syncingRef.current) return;
    setScrollTop(body.scrollTop);
    setScrollLeft(body.scrollLeft);
    syncingRef.current = true;
    if (tableRef.current) tableRef.current.scrollTop = body.scrollTop;
    if (timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = body.scrollLeft;
    syncingRef.current = false;
  }

  function scrollTimelineToLeft(left: number) {
    const body = timelineBodyRef.current;
    if (!body) return;
    const maxScrollLeft = Math.max(body.scrollWidth - body.clientWidth, 0);
    const nextScrollLeft = Math.min(Math.max(left, 0), maxScrollLeft);
    body.scrollLeft = nextScrollLeft;
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = body.scrollLeft;
    }
    setScrollLeft(body.scrollLeft);
  }

  function scrollTimelineToSlot(slotIndex: number, align = 0.52) {
    const body = timelineBodyRef.current;
    if (!body) return;
    scrollTimelineToLeft(slotIndex * dayWidth - body.clientWidth * align);
  }

  function focusTimelineTaskStart(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    scrollTimelineToSlot(getTimelineSlotIndex(task.start, timeline), 0.14);
  }

  function handleTimelineNavigate(direction: -1 | 1) {
    const body = timelineBodyRef.current;
    if (!body) return;
    const periodStepSlots = timeUnit === "day" ? 30 : timeUnit === "week" ? 4 : 1;
    const pageStep = Math.max(dayWidth * periodStepSlots, dayWidth);
    scrollTimelineToLeft(body.scrollLeft + pageStep * direction);
  }

  function handleTableScroll() {
    closeContextMenu();
    const table = tableRef.current;
    if (!table || syncingRef.current) return;
    setScrollTop(table.scrollTop);
    syncingRef.current = true;
    if (timelineBodyRef.current) timelineBodyRef.current.scrollTop = table.scrollTop;
    syncingRef.current = false;
  }

  function closeContextMenu() {
    setTaskContextMenu(null);
  }

  function getTaskIndexFromClientY(clientY: number) {
    const table = tableRef.current;
    if (!table || displayRows.length === 0) return -1;
    const tableRect = table.getBoundingClientRect();
    const y = clientY - tableRect.top + table.scrollTop;
    const index = Math.floor(y / rowHeight);
    return Math.min(Math.max(index, 0), displayRows.length - 1);
  }

  function getVisibleSubtreeEndIndex(startIndex: number) {
    const startRow = displayRows[startIndex];
    if (!startRow) return startIndex;
    let endIndex = startIndex;
    for (let index = startIndex + 1; index < displayRows.length; index += 1) {
      if (displayRows[index].depth <= startRow.depth) break;
      endIndex = index;
    }
    return endIndex;
  }

  function getRowReorderRootIds(taskIds: string[]) {
    const selectedIds = new Set(taskIds);
    return tasks
      .filter(
        (task) => selectedIds.has(task.id) && !hasSelectedAncestor(task.id, selectedIds, taskById),
      )
      .map((task) => task.id);
  }

  function hasSelectedAncestor(
    taskId: string,
    selectedIds: Set<string>,
    taskById: Map<string, ScheduleTask>,
  ) {
    let parentId = taskById.get(taskId)?.parentId;
    while (parentId) {
      if (selectedIds.has(parentId)) return true;
      parentId = taskById.get(parentId)?.parentId;
    }
    return false;
  }

  function getRowReorderTaskIds(sourceTaskId: string) {
    if (!selectedTaskIds.has(sourceTaskId)) return [sourceTaskId];
    return tasks.filter((task) => selectedTaskIds.has(task.id)).map((task) => task.id);
  }

  /** 親IDの隣接Mapを使い、子孫タスクを線形時間で収集します。 */
  function getDescendantTaskIds(taskId: string) {
    const ids = new Set<string>();
    const pending = [...(taskChildrenByParentId.get(taskId) ?? [])];
    while (pending.length > 0) {
      const task = pending.pop();
      if (!task) continue;
      ids.add(task.id);
      pending.push(...(taskChildrenByParentId.get(task.id) ?? []));
    }
    return ids;
  }

  function getMovingSubtreeIds(rootIds: string[]) {
    const ids = new Set<string>();
    rootIds.forEach((taskId) => {
      ids.add(taskId);
      getDescendantTaskIds(taskId).forEach((id) => ids.add(id));
    });
    return ids;
  }

  function getRowReorderMode(clientX: number, startX: number) {
    const deltaX = clientX - startX;
    if (deltaX > 34) return "child" as const;
    if (deltaX < -34) return "outdent" as const;
    return "sibling" as const;
  }

  function getRowReorderPlacement(clientY: number, targetIndex: number) {
    const table = tableRef.current;
    if (!table) return "before" satisfies TaskSiblingReorderPlacement;
    const tableRect = table.getBoundingClientRect();
    const y = clientY - tableRect.top + table.scrollTop;
    const offsetWithinRow = y - targetIndex * rowHeight;
    return offsetWithinRow > rowHeight / 2 ? "after" : "before";
  }

  function getRowReorderStateFromClientY(
    clientX: number,
    clientY: number,
    sourceTaskId: string,
    draggingTaskIds: string[],
    startX: number,
  ): RowReorderState {
    const targetIndex = getTaskIndexFromClientY(clientY);
    const targetRow = targetIndex >= 0 ? displayRows[targetIndex] : undefined;
    const placement = getRowReorderPlacement(clientY, Math.max(targetIndex, 0));
    const mode = getRowReorderMode(clientX, startX);
    if (!targetRow) {
      return {
        draggingTaskIds,
        mode,
        placement,
        referenceTaskId: null,
        reason: "移動先なし",
        sourceTaskId,
        targetParentId: null,
        targetTaskId: null,
        valid: false,
      };
    }

    const targetTask = taskById.get(targetRow.id);
    const rootIds = getRowReorderRootIds(draggingTaskIds);
    const rootTasks = rootIds
      .map((taskId) => taskById.get(taskId))
      .filter((task): task is ScheduleTask => Boolean(task));
    const selectedIds = new Set(draggingTaskIds);
    const movingSubtreeIds = getMovingSubtreeIds(rootIds);
    const targetIsMovingSubtree = movingSubtreeIds.has(targetRow.id);
    const sameParent =
      targetTask !== undefined &&
      rootTasks.length > 0 &&
      rootTasks.every((task) => task.parentId === targetTask.parentId);
    const targetIsSelected = selectedIds.has(targetRow.id);

    if (mode === "child") {
      const canNest =
        targetTask !== undefined &&
        targetTask.type !== "milestone" &&
        rootTasks.length > 0 &&
        !targetIsMovingSubtree;
      return {
        draggingTaskIds,
        mode,
        placement: "after",
        referenceTaskId: null,
        reason: targetIsMovingSubtree
          ? "選択行の外へ"
          : targetTask?.type === "milestone"
            ? "マイルストーン不可"
            : "子階層へ入れる",
        sourceTaskId,
        targetParentId: targetTask?.id ?? null,
        targetTaskId: targetRow.id,
        valid: canNest,
      };
    }

    if (mode === "outdent") {
      const parentIds = Array.from(new Set(rootTasks.map((task) => task.parentId)));
      const sourceParentId = parentIds.length === 1 ? parentIds[0] : null;
      const sourceParent = sourceParentId ? tasks.find((task) => task.id === sourceParentId) : null;
      const canOutdent = rootTasks.length > 0 && parentIds.length === 1 && Boolean(sourceParent);
      return {
        draggingTaskIds,
        mode,
        placement: "after",
        referenceTaskId: sourceParent?.id ?? null,
        reason: parentIds.length > 1 ? "同じ親の行のみ" : "親階層へ出す",
        sourceTaskId,
        targetParentId: sourceParent?.parentId ?? null,
        targetTaskId: sourceParent?.id ?? targetRow.id,
        valid: canOutdent,
      };
    }

    return {
      draggingTaskIds,
      mode,
      placement,
      referenceTaskId: null,
      reason: targetIsSelected ? "選択行の外へ" : "同階層のみ",
      sourceTaskId,
      targetParentId: targetTask?.parentId ?? null,
      targetTaskId: targetRow.id,
      valid: sameParent && !targetIsSelected,
    };
  }

  function autoScrollTaskTable(clientY: number) {
    const table = tableRef.current;
    if (!table) return;
    const tableRect = table.getBoundingClientRect();
    const edgeSize = 42;
    const delta =
      clientY < tableRect.top + edgeSize
        ? -rowHeight
        : clientY > tableRect.bottom - edgeSize
          ? rowHeight
          : 0;
    if (delta === 0) return;
    const nextScrollTop = Math.min(
      Math.max(table.scrollTop + delta, 0),
      table.scrollHeight - table.clientHeight,
    );
    if (nextScrollTop === table.scrollTop) return;
    table.scrollTop = nextScrollTop;
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = nextScrollTop;
    }
    setScrollTop(nextScrollTop);
  }

  function isDragSelectionBlocked(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
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

  function selectRangeByIndex(anchorIndex: number, currentIndex: number) {
    const anchorTask = displayRows[anchorIndex];
    const currentTask = displayRows[currentIndex];
    if (!anchorTask || !currentTask) return;
    onSelectTaskRange(anchorTask.id, currentTask.id);
  }

  function handleTableClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressDragClickRef.current) return;
    suppressDragClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleTablePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isDragSelectionBlocked(event.target)) return;

    const anchorIndex = getTaskIndexFromClientY(event.clientY);
    if (anchorIndex < 0) return;

    closeContextMenu();
    dragSelectionSessionRef.current = {
      active: false,
      anchorIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    function removeDragListeners() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
    }

    function handlePointerMove(pointerEvent: PointerEvent) {
      const session = dragSelectionSessionRef.current;
      if (!session || pointerEvent.pointerId !== session.pointerId) return;

      const currentIndex = getTaskIndexFromClientY(pointerEvent.clientY);
      if (currentIndex < 0) return;

      const distance = Math.hypot(
        pointerEvent.clientX - session.startX,
        pointerEvent.clientY - session.startY,
      );
      if (!session.active && distance < 5) return;

      if (!session.active) {
        session.active = true;
        window.getSelection()?.removeAllRanges();
      }

      pointerEvent.preventDefault();
      setDragSelection({ anchorIndex: session.anchorIndex, currentIndex });
      selectRangeByIndex(session.anchorIndex, currentIndex);
    }

    function handlePointerEnd(pointerEvent: PointerEvent) {
      const session = dragSelectionSessionRef.current;
      if (!session || pointerEvent.pointerId !== session.pointerId) return;

      removeDragListeners();
      if (session.active) {
        const currentIndex = getTaskIndexFromClientY(pointerEvent.clientY);
        if (currentIndex >= 0) {
          selectRangeByIndex(session.anchorIndex, currentIndex);
        }
        suppressDragClickRef.current = true;
        window.setTimeout(() => {
          suppressDragClickRef.current = false;
        }, 0);
      }
      dragSelectionSessionRef.current = null;
      setDragSelection(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
  }

  function handleRowReorderPointerDown(
    taskId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0 || (displayMode === "table" && tableSort.key !== null)) return;
    event.preventDefault();
    event.stopPropagation();

    const draggingTaskIds = getRowReorderTaskIds(taskId);
    if (!selectedTaskIds.has(taskId)) {
      onSelectTask(taskId);
    }
    closeContextMenu();
    setDragSelection(null);
    rowReorderSessionRef.current = {
      active: false,
      draggingTaskIds,
      pointerId: event.pointerId,
      sourceTaskId: taskId,
      startX: event.clientX,
      startY: event.clientY,
    };

    function removeReorderListeners() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
    }

    function handlePointerMove(pointerEvent: PointerEvent) {
      const session = rowReorderSessionRef.current;
      if (!session || pointerEvent.pointerId !== session.pointerId) return;

      const distance = Math.hypot(
        pointerEvent.clientX - session.startX,
        pointerEvent.clientY - session.startY,
      );
      if (!session.active && distance < 5) return;

      if (!session.active) {
        session.active = true;
        window.getSelection()?.removeAllRanges();
      }

      pointerEvent.preventDefault();
      autoScrollTaskTable(pointerEvent.clientY);
      setRowReorder(
        getRowReorderStateFromClientY(
          pointerEvent.clientX,
          pointerEvent.clientY,
          session.sourceTaskId,
          session.draggingTaskIds,
          session.startX,
        ),
      );
    }

    function handlePointerEnd(pointerEvent: PointerEvent) {
      const session = rowReorderSessionRef.current;
      if (!session || pointerEvent.pointerId !== session.pointerId) return;

      removeReorderListeners();
      if (session.active) {
        const dropState = getRowReorderStateFromClientY(
          pointerEvent.clientX,
          pointerEvent.clientY,
          session.sourceTaskId,
          session.draggingTaskIds,
          session.startX,
        );
        if (dropState.valid && dropState.targetTaskId) {
          if (dropState.mode === "sibling") {
            onReorderTasksToTarget(
              dropState.targetTaskId,
              dropState.placement,
              session.draggingTaskIds,
            );
          } else {
            onReparentTasksByDrag(
              dropState.targetParentId,
              session.draggingTaskIds,
              dropState.referenceTaskId,
              dropState.placement,
            );
          }
        }
        suppressDragClickRef.current = true;
        window.setTimeout(() => {
          suppressDragClickRef.current = false;
        }, 0);
      }

      rowReorderSessionRef.current = null;
      setRowReorder(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
  }

  function openTaskContextMenu(taskId: string, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedTaskIds.has(taskId)) {
      onSelectTask(taskId);
    }
    setTaskContextMenu({
      taskId,
      x: Math.min(event.clientX, Math.max(window.innerWidth - 264, 12)),
      y: Math.min(event.clientY, Math.max(window.innerHeight - 470, 12)),
    });
  }

  function runContextAction(action: () => void) {
    action();
    closeContextMenu();
  }

  const contextTask = taskContextMenu
    ? (tasks.find((task) => task.id === taskContextMenu.taskId) ?? null)
    : null;
  const contextTaskSelected = contextTask !== null && selectedTaskIds.has(contextTask.id);
  const contextActionTaskId = contextTaskSelected ? undefined : taskContextMenu?.taskId;
  const contextSelectionCount = contextTaskSelected ? selectedTaskIds.size : contextTask ? 1 : 0;
  const contextSelectedTasks = contextTask
    ? contextTaskSelected
      ? tasks.filter((task) => selectedTaskIds.has(task.id))
      : [contextTask]
    : [];
  const canContextEdit = contextSelectedTasks.some((task) => task.parentId !== null);
  const canContextBulkEdit = contextSelectedTasks.some(
    (task) => task.type !== "summary" && task.type !== "phase",
  );
  const canContextShift = contextSelectedTasks.some((task) => task.type !== "summary");
  const canContextReorder = contextSelectedTasks.length > 0;

  return (
    <section className="workbench">
      {!canEditPlan ? (
        <div className="gantt-permission-notice" role="status">
          計画は参照専用です。担当タスクの状態・進捗・実績日は更新できます。
        </div>
      ) : null}
      <GanttToolbar
        activeFilterCount={activeFilterCount}
        calendarAware={calendarAware}
        canUseTaskActions={canEditPlan && selectedTaskCount > 0}
        columnVisibility={columnVisibility}
        filterOpen={filterOpen}
        filters={filters}
        members={members}
        onBulkAssigneeChange={onBulkAssigneeChange}
        onBulkDateShift={onBulkDateShift}
        onBulkStatusChange={onBulkStatusChange}
        onCalendarAwareChange={onCalendarAwareChange}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onClearSelection={onClearSelection}
        onCreateTask={onCreateTask}
        onDeleteTask={onDeleteTask}
        onFilterOpenChange={onFilterOpenChange}
        onAssigneeChange={onAssigneeChange}
        onScaleChange={onScaleChange}
        onShortcutHelp={onShortcutHelp}
        onTimelineNavigate={handleTimelineNavigate}
        onTimeUnitChange={onTimeUnitChange}
        onToday={onToday}
        scale={scale}
        selectedTaskCount={selectedTaskCount}
        timeUnit={timeUnit}
        displayMode={displayMode}
        onDisplayModeChange={onDisplayModeChange}
        onTableSortReset={() => setTableSort({ direction: "asc", key: null })}
        tableSortKey={tableSort.key}
      />

      <div
        className={displayMode === "table" ? "gantt-shell table-view" : "gantt-shell"}
        data-tour="gantt-grid"
        style={
          {
            "--task-table-columns": taskTableColumns,
          } as CSSProperties
        }
      >
        <TaskTableHeader
          columnVisibility={columnVisibility}
          displayMode={displayMode}
          onSortChange={(key: TaskTableSortKey) =>
            setTableSort((current) => ({
              direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
              key,
            }))
          }
          sort={tableSort}
        />
        {displayMode === "gantt" ? (
          <TimelineGrid
            dayWidth={dayWidth}
            headerRef={timelineHeaderRef}
            members={members}
            months={months}
            onBodyScroll={handleTimelineScroll}
            onTaskContextMenu={openTaskContextMenu}
            onMoveTask={onMoveTask}
            onMoveSelectedTasks={onBulkDateShift}
            onFocusTaskStart={focusTimelineTaskStart}
            onOpenTaskInspector={onOpenTaskInspector}
            onResizeTask={onResizeTask}
            onSelectTask={onSelectTask}
            dependencyIssueByTaskId={dependencyIssueByTaskId}
            query=""
            rowIndexOffset={virtualWindow.start}
            rows={virtualWindow.rows}
            selectedTaskIds={selectedTaskIds}
            timeUnit={timeUnit}
            timelineBodyRef={timelineBodyRef}
            timeline={timeline}
            todayKey={todayKey}
            totalRows={rows.length}
            visibleSlotWindow={visibleSlotWindow}
            viewportHeight={viewportHeight}
            weeks={weeks}
          />
        ) : null}

        <div
          className={
            rowReorder
              ? "task-table reordering"
              : dragSelection
                ? "task-table selecting"
                : "task-table"
          }
          data-tour="gantt-task-table"
          onClickCapture={handleTableClickCapture}
          onPointerDown={handleTablePointerDown}
          onScroll={handleTableScroll}
          ref={tableRef}
        >
          <div
            className="task-table-spacer"
            style={{ height: virtualWindow.totalHeight } as CSSProperties}
          >
            {dragSelectionBox ? (
              <div
                aria-hidden="true"
                className="row-drag-selection"
                style={dragSelectionBox as CSSProperties}
              />
            ) : null}
            {rowReorderGuide ? (
              <div
                aria-hidden="true"
                className={
                  rowReorderGuide.valid ? "row-reorder-guide" : "row-reorder-guide invalid"
                }
                style={{ top: rowReorderGuide.top } as CSSProperties}
              >
                <span>{rowReorderGuide.label}</span>
              </div>
            ) : null}
            <div
              className="task-table-window"
              style={{ top: virtualWindow.topSpacer } as CSSProperties}
            >
              {virtualWindow.rows.map((task) => (
                <TaskTableRow
                  collapsed={collapsedIds.has(task.id)}
                  columnVisibility={columnVisibility}
                  key={task.id}
                  dependencyIssues={dependencyIssueByTaskId.get(task.id) ?? []}
                  dragReordering={Boolean(rowReorder?.draggingTaskIds.includes(task.id))}
                  members={members}
                  onContextMenu={(event) => openTaskContextMenu(task.id, event)}
                  onDragHandlePointerDown={(event) => handleRowReorderPointerDown(task.id, event)}
                  onFocusTaskStart={() => focusTimelineTaskStart(task.id)}
                  onOpenInspector={() => onOpenTaskInspector(task.id)}
                  onSelect={(options) => onSelectTask(task.id, options)}
                  onToggle={() => onToggleCollapsed(task.id)}
                  onUpdateTask={onUpdateTask}
                  query=""
                  selected={selectedTaskIds.has(task.id)}
                  task={task}
                  titleEditSignal={
                    taskTitleEditRequest.taskId === task.id ? taskTitleEditRequest.requestId : 0
                  }
                  canReorder={displayMode !== "table" || tableSort.key === null}
                  showDates={displayMode === "table"}
                />
              ))}
            </div>
          </div>
        </div>

        {filterOpen ? (
          <FilterPanel
            filters={filters}
            members={members}
            onAssigneeChange={onAssigneeChange}
            onClose={() => onFilterOpenChange(false)}
            onReset={onFilterReset}
            onStatusToggle={onStatusToggle}
          />
        ) : null}

        {taskContextMenu && contextTask ? (
          <div
            aria-label="タスク操作メニュー"
            className="task-context-menu"
            onContextMenu={(event) => event.preventDefault()}
            ref={taskContextMenuRef}
            role="menu"
            style={
              {
                left: taskContextMenu.x,
                top: taskContextMenu.y,
              } as CSSProperties
            }
          >
            <div className="task-context-menu-heading">
              <strong>{contextTask.title}</strong>
              <span>{contextSelectionCount}行を操作</span>
            </div>
            <button
              disabled={!canContextEdit}
              onClick={() => runContextAction(() => onCopyTask(contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <ClipboardDocumentIcon />
              コピー
            </button>
            <button
              disabled={!canPasteTask}
              onClick={() => runContextAction(() => onPasteTask(taskContextMenu.taskId))}
              role="menuitem"
              type="button"
            >
              <ClipboardDocumentCheckIcon />
              貼り付け
            </button>
            <button
              disabled={!canContextEdit}
              onClick={() => runContextAction(() => onDuplicateTask(contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <DocumentDuplicateIcon />
              複製
            </button>
            <div className="task-context-menu-separator" />
            <label className="task-context-select">
              <span>状態</span>
              <select
                aria-label="選択行の状態を変更"
                disabled={!canContextBulkEdit}
                onChange={(event) => {
                  if (!event.target.value) return;
                  runContextAction(() =>
                    onBulkStatusChange(event.target.value as TaskStatus, contextActionTaskId),
                  );
                }}
                value=""
              >
                <option value="">変更なし</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="task-context-select">
              <span>担当</span>
              <select
                aria-label="選択行の担当者を変更"
                disabled={!canContextBulkEdit}
                onChange={(event) => {
                  if (!event.target.value) return;
                  runContextAction(() =>
                    onBulkAssigneeChange(event.target.value, contextActionTaskId),
                  );
                }}
                value=""
              >
                <option value="">変更なし</option>
                {assigneeOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.initials} {member.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="task-context-menu-separator" />
            <button
              disabled={!canContextEdit}
              onClick={() => runContextAction(onOutdentTasks)}
              role="menuitem"
              type="button"
            >
              <ArrowLeftIcon />
              階層を上げる
            </button>
            <button
              disabled={!canContextEdit}
              onClick={() => runContextAction(onIndentTasks)}
              role="menuitem"
              type="button"
            >
              <ArrowRightIcon />
              階層を下げる
            </button>
            <div className="task-context-menu-separator" />
            <button
              disabled={!canContextReorder}
              onClick={() => runContextAction(() => onReorderTasks(-1, contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <ArrowUpIcon />
              上へ移動
            </button>
            <button
              disabled={!canContextReorder}
              onClick={() => runContextAction(() => onReorderTasks(1, contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <ArrowDownIcon />
              下へ移動
            </button>
            <div className="task-context-menu-separator" />
            <button
              disabled={!canContextShift}
              onClick={() => runContextAction(() => onBulkDateShift(-1, contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <ArrowLeftIcon />
              1日前へ移動
            </button>
            <button
              disabled={!canContextShift}
              onClick={() => runContextAction(() => onBulkDateShift(1, contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <ArrowRightIcon />
              1日後へ移動
            </button>
            <div className="task-context-menu-separator" />
            <button
              className="danger"
              disabled={!canContextEdit}
              onClick={() => runContextAction(() => onDeleteTask(contextActionTaskId))}
              role="menuitem"
              type="button"
            >
              <TrashIcon />
              削除
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
