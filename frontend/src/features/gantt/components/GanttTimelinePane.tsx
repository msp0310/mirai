import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { MouseEvent, RefObject } from "react";

import type { DependencyIssue } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  GanttTimeUnit,
  Member,
  ScheduleTask,
  TaskInspectorFocusTarget,
  TaskRow,
  TimelineColumn,
  TimelineDay,
} from "../../../types/schedule";
import { todayKey } from "./constants";
import { TimelineGrid } from "./TimelineGrid";

type GanttTimelinePaneProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  dayWidth: number;
  dependencyIssueByTaskId: Map<string, DependencyIssue[]>;
  headerRef: RefObject<HTMLDivElement | null>;
  members: Member[];
  months: TimelineColumn[];
  onBodyScroll: () => void;
  onFocusTaskStart: (taskId: string) => void;
  onMoveSelectedTasks: (deltaDays: number, taskId?: string | null) => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onOpenTaskInspector: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelectTask: (taskId: string) => void;
  onTaskContextMenu: (taskId: string, event: MouseEvent<HTMLElement>) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  projectRangeEnd: string;
  projectRangeStart: string;
  rowIndexOffset: number;
  rows: TaskRow[];
  selectedTaskIds: Set<string>;
  timeUnit: GanttTimeUnit;
  timeline: TimelineDay[];
  timelineBodyRef: RefObject<HTMLDivElement | null>;
  timelineFocusTask: ScheduleTask | null;
  totalRows: number;
  visibleSlotWindow: { end: number; start: number };
  viewportHeight: number;
  weeks: TimelineColumn[];
};

/** ガントの時間軸と、表示期間外タスクへの移動導線を描画します。 */
export function GanttTimelinePane({
  calendar,
  calendarAware,
  dayWidth,
  dependencyIssueByTaskId,
  headerRef,
  members,
  months,
  onBodyScroll,
  onFocusTaskStart,
  onMoveSelectedTasks,
  onMoveTask,
  onOpenTaskInspector,
  onResizeTask,
  onSelectTask,
  onTaskContextMenu,
  onUpdateTask,
  projectRangeEnd,
  projectRangeStart,
  rowIndexOffset,
  rows,
  selectedTaskIds,
  timeUnit,
  timeline,
  timelineBodyRef,
  timelineFocusTask,
  totalRows,
  visibleSlotWindow,
  viewportHeight,
  weeks,
}: GanttTimelinePaneProps) {
  return (
    <>
      <TimelineGrid
        calendar={calendar}
        calendarAware={calendarAware}
        dayWidth={dayWidth}
        dependencyIssueByTaskId={dependencyIssueByTaskId}
        headerRef={headerRef}
        members={members}
        months={months}
        onBodyScroll={onBodyScroll}
        onFocusTaskStart={onFocusTaskStart}
        onMoveSelectedTasks={onMoveSelectedTasks}
        onMoveTask={onMoveTask}
        onOpenTaskInspector={onOpenTaskInspector}
        onResizeTask={onResizeTask}
        onSelectTask={onSelectTask}
        onTaskContextMenu={onTaskContextMenu}
        onUpdateTask={onUpdateTask}
        projectRangeEnd={projectRangeEnd}
        projectRangeStart={projectRangeStart}
        query=""
        rowIndexOffset={rowIndexOffset}
        rows={rows}
        selectedTaskIds={selectedTaskIds}
        timeUnit={timeUnit}
        timeline={timeline}
        timelineBodyRef={timelineBodyRef}
        todayKey={todayKey}
        totalRows={totalRows}
        visibleSlotWindow={visibleSlotWindow}
        viewportHeight={viewportHeight}
        weeks={weeks}
      />
      {timelineFocusTask ? (
        <div className="gantt-out-of-range-guide" role="status">
          <CalendarDaysIcon />
          <div>
            <strong>この期間に表示するタスクはありません</strong>
            <span>初期表示は今日です。作業期間へ移動してタスクを確認できます。</span>
          </div>
          <button onClick={() => onFocusTaskStart(timelineFocusTask.id)} type="button">
            {timelineFocusTask.status === "done" ? "案件期間へ" : "未完了タスクへ"}
          </button>
        </div>
      ) : null}
    </>
  );
}
