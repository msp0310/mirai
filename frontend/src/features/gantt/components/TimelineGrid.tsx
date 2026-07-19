import { type CSSProperties, type MouseEvent, type RefObject } from "react";

import { type DependencyIssue, taskMatchesQuery } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  GanttTimeUnit,
  Member,
  TaskRow,
  TimelineColumn,
  TimelineDay,
} from "../../../types/schedule";
import type { VisibleTimelineSlotWindow } from "../types/ganttState";
import { useTimelinePan } from "../hooks/useTimelinePan";
import { rowHeight } from "./constants";
import { TimelineCalendarBackdrop } from "./TimelineCalendarBackdrop";
import { TimelineDependencyOverlay } from "./TimelineDependencyOverlay";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineTaskRow } from "./TimelineTaskRow";

type TimelineGridProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  dayWidth: number;
  headerRef: RefObject<HTMLDivElement | null>;
  members: Member[];
  months: TimelineColumn[];
  onBodyScroll: () => void;
  onTaskContextMenu: (taskId: string, event: MouseEvent<HTMLElement>) => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onMoveSelectedTasks: (deltaDays: number) => void;
  onFocusTaskStart: (taskId: string) => void;
  onOpenTaskInspector: (taskId: string) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelectTask: (taskId: string, options?: { additive?: boolean; range?: boolean }) => void;
  projectRangeEnd: string;
  projectRangeStart: string;
  dependencyIssueByTaskId: Map<string, DependencyIssue[]>;
  query: string;
  rowIndexOffset: number;
  rows: TaskRow[];
  selectedTaskIds: Set<string>;
  timeUnit: GanttTimeUnit;
  timelineBodyRef: RefObject<HTMLDivElement | null>;
  timeline: TimelineDay[];
  todayKey: string;
  totalRows: number;
  visibleSlotWindow: VisibleTimelineSlotWindow;
  viewportHeight: number;
  weeks: TimelineColumn[];
};

/** ガント右側のタイムラインとタスクバーを仮想化して描画します。 */
export function TimelineGrid({
  calendar,
  calendarAware,
  dayWidth,
  headerRef,
  members,
  months,
  onBodyScroll,
  onTaskContextMenu,
  onMoveTask,
  onMoveSelectedTasks,
  onFocusTaskStart,
  onOpenTaskInspector,
  onResizeTask,
  onSelectTask,
  projectRangeEnd,
  projectRangeStart,
  dependencyIssueByTaskId,
  query,
  rowIndexOffset,
  rows,
  selectedTaskIds,
  timeUnit,
  timelineBodyRef,
  timeline,
  todayKey,
  totalRows,
  visibleSlotWindow,
  viewportHeight,
  weeks,
}: TimelineGridProps) {
  const timelineWidth = timeline.length * dayWidth;
  const bodyHeight = Math.max(totalRows * rowHeight, viewportHeight);
  const timelinePanHandlers = useTimelinePan();
  return (
    <>
      <TimelineHeader
        dayWidth={dayWidth}
        headerRef={headerRef}
        months={months}
        projectRangeEnd={projectRangeEnd}
        timeUnit={timeUnit}
        timeline={timeline}
        todayKey={todayKey}
        visibleSlotWindow={visibleSlotWindow}
        weeks={weeks}
      />

      <div
        className="timeline-body"
        onScroll={onBodyScroll}
        ref={timelineBodyRef}
        {...timelinePanHandlers}
      >
        <div
          className="timeline-canvas"
          style={
            {
              "--day-width": `${dayWidth}px`,
              "--row-height": `${rowHeight}px`,
              height: bodyHeight,
              width: timelineWidth,
            } as CSSProperties
          }
          data-total-slots={timeline.length}
          data-visible-slot-end={visibleSlotWindow.end}
          data-visible-slot-start={visibleSlotWindow.start}
        >
          <TimelineCalendarBackdrop
            bodyHeight={bodyHeight}
            dayWidth={dayWidth}
            days={timeline}
            projectRangeEnd={projectRangeEnd}
            projectRangeStart={projectRangeStart}
            todayKey={todayKey}
            visibleSlotWindow={visibleSlotWindow}
          />
          {rows.map((task, index) => (
            <TimelineTaskRow
              index={rowIndexOffset + index}
              calendar={calendar}
              calendarAware={calendarAware}
              dayWidth={dayWidth}
              members={members}
              key={task.id}
              onMoveTask={onMoveTask}
              onMoveSelectedTasks={onMoveSelectedTasks}
              onFocusTaskStart={() => onFocusTaskStart(task.id)}
              onResizeTask={onResizeTask}
              onContextMenu={(event) => onTaskContextMenu(task.id, event)}
              onOpenInspector={() => onOpenTaskInspector(task.id)}
              onSelect={(options) => onSelectTask(task.id, options)}
              dependencyIssues={dependencyIssueByTaskId.get(task.id) ?? []}
              searchMatched={taskMatchesQuery(task, query)}
              selected={selectedTaskIds.has(task.id)}
              selectedTaskCount={selectedTaskIds.size}
              task={task}
              timeUnit={timeUnit}
              timeline={timeline}
              visibleSlotWindow={visibleSlotWindow}
            />
          ))}
          <TimelineDependencyOverlay
            dayWidth={dayWidth}
            dependencyIssueByTaskId={dependencyIssueByTaskId}
            rowIndexOffset={rowIndexOffset}
            rows={rows}
            timeline={timeline}
            visibleSlotWindow={visibleSlotWindow}
          />
        </div>
      </div>
    </>
  );
}
