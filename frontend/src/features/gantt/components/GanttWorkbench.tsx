import { type CSSProperties, useMemo, useState } from "react";

import "./GanttViewport.css";
import { type DependencyIssue, getDependencyIssues } from "../../../lib/schedule";
import type { TaskSiblingReorderPlacement } from "../../../lib/taskOperations";
import type {
  CalendarDefinition,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  Member,
  ScheduleFilters,
  ScheduleTask,
  TaskInspectorFocusTarget,
  TaskRow,
  TaskStatus,
  TimelineColumn,
  TimelineDay,
} from "../../../types/schedule";
import { useGanttViewport } from "../hooks/useGanttViewport";
import { useSuppressedTableClick } from "../hooks/useSuppressedTableClick";
import { useTaskContextMenu } from "../hooks/useTaskContextMenu";
import { useTaskDragSelection } from "../hooks/useTaskDragSelection";
import { useTaskRowReorder } from "../hooks/useTaskRowReorder";
import {
  buildTaskTreeGuideStates,
  sortTaskRowsPreservingHierarchy,
} from "../lib/taskTableModel";
import type { TaskTableSortKey, TaskTableSortState } from "../types/ganttState";
import { rowHeight } from "./constants";
import { FilterPanel } from "./FilterPanel";
import { GanttTimelinePane } from "./GanttTimelinePane";
import { GanttToolbar } from "./GanttToolbar";
import { TaskContextMenu } from "./TaskContextMenu";
import { TaskTableHeader } from "./TaskTableHeader";
import { TaskTableViewport } from "./TaskTableViewport";

type GanttWorkbenchProps = {
  activeFilterCount: number;
  calendar: CalendarDefinition;
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
  projectRangeEnd: string;
  projectRangeStart: string;
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

/** 大量のタスクを編集・選択・移動できるガントワークベンチです。 */
export function GanttWorkbench({
  activeFilterCount,
  calendar,
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
  projectRangeEnd,
  projectRangeStart,
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
  const {
    closeContextMenu,
    contextMenu: taskContextMenu,
    contextMenuRef: taskContextMenuRef,
    openContextMenu: openTaskContextMenu,
  } = useTaskContextMenu({ onSelectTask, selectedTaskIds });
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
  const displayRows = useMemo(
    () =>
      displayMode === "table" ? sortTaskRowsPreservingHierarchy(rows, tableSort, members) : rows,
    [displayMode, members, rows, tableSort],
  );
  const taskTreeGuideStates = useMemo(
    () => buildTaskTreeGuideStates(displayRows),
    [displayRows],
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
  const {
    focusTimelineTaskStart,
    handleTableScroll,
    handleTimelineNavigate,
    handleTimelineScroll,
    scrollLeft,
    scrollTop,
    setSynchronizedScrollTop,
    tableScrollRangeCompensation,
    tableRef,
    timelineBodyRef,
    timelineHeaderRef,
    timelineViewportWidth,
    viewportHeight,
  } = useGanttViewport({
    dayWidth,
    displayRows,
    onInteractionStart: closeContextMenu,
    projectRangeEnd,
    projectRangeStart,
    selectedTaskId,
    tasks,
    taskStartFocusSignal,
    timeline,
    timeUnit,
    todaySignal,
  });
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
      totalHeight: displayRows.length * rowHeight + tableScrollRangeCompensation,
    };
  }, [displayRows, scrollTop, tableScrollRangeCompensation, viewportHeight]);
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
  const visibleTimelineRange = useMemo(() => {
    const firstVisibleIndex = Math.max(Math.floor(scrollLeft / dayWidth), 0);
    const lastVisibleIndex = Math.min(
      Math.max(
        Math.ceil((scrollLeft + (timelineViewportWidth || 980)) / dayWidth) - 1,
        firstVisibleIndex,
      ),
      timeline.length - 1,
    );
    const firstSlot = timeline[firstVisibleIndex];
    const lastSlot = timeline[lastVisibleIndex];
    return firstSlot && lastSlot ? { end: lastSlot.end, start: firstSlot.start } : null;
  }, [dayWidth, scrollLeft, timeline, timelineViewportWidth]);
  const hasTaskInVisibleTimeline = useMemo(
    () =>
      visibleTimelineRange !== null &&
      rows.some(
        (task) => task.start <= visibleTimelineRange.end && task.end >= visibleTimelineRange.start,
      ),
    [rows, visibleTimelineRange],
  );
  const timelineFocusTask = useMemo(
    () =>
      tasks
        .filter((task) => task.type === "task" && task.status !== "done")
        .toSorted((a, b) => a.start.localeCompare(b.start))[0] ??
      tasks.toSorted((a, b) => a.start.localeCompare(b.start))[0] ??
      null,
    [tasks],
  );
  const { handleClickCapture: handleTableClickCapture, suppressNextClick } =
    useSuppressedTableClick();
  const { clearDragSelection, dragSelectionBox, handleTablePointerDown } = useTaskDragSelection({
    displayRows,
    onInteractionStart: closeContextMenu,
    onSelectTaskRange,
    suppressNextClick,
    tableRef,
  });
  const { handleRowReorderPointerDown, rowReorder, rowReorderGuide } = useTaskRowReorder({
    clearDragSelection,
    displayMode,
    displayRows,
    onInteractionStart: closeContextMenu,
    onReorderTasksToTarget,
    onReparentTasksByDrag,
    onSelectTask,
    selectedTaskIds,
    setSynchronizedScrollTop,
    suppressNextClick,
    tableRef,
    tableSortKey: tableSort.key,
    tasks,
  });
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
          <GanttTimelinePane
            calendar={calendar}
            calendarAware={calendarAware}
            dayWidth={dayWidth}
            dependencyIssueByTaskId={dependencyIssueByTaskId}
            headerRef={timelineHeaderRef}
            members={members}
            months={months}
            onBodyScroll={handleTimelineScroll}
            onFocusTaskStart={focusTimelineTaskStart}
            onMoveSelectedTasks={onBulkDateShift}
            onMoveTask={onMoveTask}
            onOpenTaskInspector={onOpenTaskInspector}
            onResizeTask={onResizeTask}
            onSelectTask={onSelectTask}
            onTaskContextMenu={openTaskContextMenu}
            onUpdateTask={onUpdateTask}
            projectRangeEnd={projectRangeEnd}
            projectRangeStart={projectRangeStart}
            rowIndexOffset={virtualWindow.start}
            rows={virtualWindow.rows}
            selectedTaskIds={selectedTaskIds}
            timeUnit={timeUnit}
            timeline={timeline}
            timelineBodyRef={timelineBodyRef}
            timelineFocusTask={hasTaskInVisibleTimeline ? null : timelineFocusTask}
            totalRows={rows.length}
            visibleSlotWindow={visibleSlotWindow}
            viewportHeight={viewportHeight}
            weeks={weeks}
          />
        ) : null}

        <TaskTableViewport
          collapsedIds={collapsedIds}
          columnVisibility={columnVisibility}
          dependencyIssueByTaskId={dependencyIssueByTaskId}
          displayMode={displayMode}
          dragSelectionBox={dragSelectionBox}
          members={members}
          onClickCapture={handleTableClickCapture}
          onContextMenu={openTaskContextMenu}
          onDragHandlePointerDown={handleRowReorderPointerDown}
          onFocusTaskStart={focusTimelineTaskStart}
          onOpenTaskInspector={onOpenTaskInspector}
          onPointerDown={handleTablePointerDown}
          onScroll={handleTableScroll}
          onSelectTask={onSelectTask}
          onToggleCollapsed={onToggleCollapsed}
          onUpdateTask={onUpdateTask}
          rowReorder={rowReorder}
          rowReorderGuide={rowReorderGuide}
          selectedTaskIds={selectedTaskIds}
          tableRef={tableRef}
          tableSortKey={tableSort.key}
          taskTitleEditRequest={taskTitleEditRequest}
          taskTreeGuideStates={taskTreeGuideStates}
          virtualWindow={virtualWindow}
        />

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

        {taskContextMenu ? (
          <TaskContextMenu
            canPasteTask={canPasteTask}
            menu={taskContextMenu}
            menuRef={taskContextMenuRef}
            members={members}
            onAssigneeChange={onBulkAssigneeChange}
            onClose={closeContextMenu}
            onCopy={onCopyTask}
            onDateShift={onBulkDateShift}
            onDelete={onDeleteTask}
            onDuplicate={onDuplicateTask}
            onIndent={onIndentTasks}
            onOutdent={onOutdentTasks}
            onPaste={onPasteTask}
            onReorder={onReorderTasks}
            onStatusChange={onBulkStatusChange}
            selectedTaskIds={selectedTaskIds}
            tasks={tasks}
          />
        ) : null}
      </div>
    </section>
  );
}
