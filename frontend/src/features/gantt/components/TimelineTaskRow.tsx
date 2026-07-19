import { type CSSProperties, type FocusEvent, type MouseEvent, useState } from "react";

import { type DependencyIssue, formatShortDate, getTaskTimelineSpan } from "../../../lib/schedule";
import { normalizeProgressStatus } from "../../../lib/taskOperations";
import type {
  CalendarDefinition,
  GanttTimeUnit,
  Member,
  ScheduleTask,
  TaskRow,
  TimelineDay,
} from "../../../types/schedule";
import { useTimelineBarInteraction } from "../hooks/useTimelineBarInteraction";
import type { VisibleTimelineSlotWindow } from "../types/ganttState";
import { rowHeight } from "./constants";

type TimelineTaskRowProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  dayWidth: number;
  index: number;
  members: Member[];
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onMoveSelectedTasks: (deltaDays: number) => void;
  onFocusTaskStart: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onOpenInspector: () => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelect: (options?: { additive?: boolean; range?: boolean }) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  dependencyIssues: DependencyIssue[];
  searchMatched: boolean;
  selected: boolean;
  selectedTaskCount: number;
  task: TaskRow;
  timeUnit: GanttTimeUnit;
  timeline: TimelineDay[];
  visibleSlotWindow: VisibleTimelineSlotWindow;
};

export function TimelineTaskRow({
  calendar,
  calendarAware,
  dayWidth,
  index,
  members,
  onMoveTask,
  onMoveSelectedTasks,
  onFocusTaskStart,
  onContextMenu,
  onOpenInspector,
  onResizeTask,
  onSelect,
  onUpdateTask,
  dependencyIssues,
  searchMatched,
  selected,
  selectedTaskCount,
  task,
  timeUnit,
  timeline,
  visibleSlotWindow,
}: TimelineTaskRowProps) {
  const [progressEditorOpen, setProgressEditorOpen] = useState(false);
  const span = getTaskTimelineSpan(task, timeline);
  const baselineSpan =
    task.baselineStart && task.baselineEnd
      ? getTaskTimelineSpan({ ...task, end: task.baselineEnd, start: task.baselineStart }, timeline)
      : null;
  const baselineSpanEnd = baselineSpan ? baselineSpan.offset + baselineSpan.duration : 0;
  const isBaselineInVisibleRange =
    baselineSpan !== null &&
    baselineSpanEnd >= visibleSlotWindow.start &&
    baselineSpan.offset <= visibleSlotWindow.end;
  const left = span.offset * dayWidth + 7;
  const width = Math.max(span.duration * dayWidth - 12, 10);
  const assigneeMeta = formatTimelineAssignees(task.assigneeIds, members);
  const metaTitle = assigneeMeta.full
    ? `${task.progress}% ${assigneeMeta.full}`
    : `${task.progress}%`;
  const baselineLeft = baselineSpan ? baselineSpan.offset * dayWidth + 7 : 0;
  const baselineWidth = baselineSpan ? Math.max(baselineSpan.duration * dayWidth - 12, 10) : 0;
  const top = index * rowHeight;
  const barHeight =
    task.type === "task" ? (task.hasChildren ? 16 : 14) : task.type === "summary" ? 18 : 17;
  const barTopOffset = (rowHeight - barHeight) / 2;
  const canResize = task.type === "task";
  const canMove = task.type !== "summary";
  const barKeyboardHint = canResize
    ? "。左右キーで日程を移動、Shiftと左右キーで終了日を変更"
    : canMove
      ? "。左右キーで日程を移動"
      : "";
  const barKeyShortcuts = canResize
    ? "ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight"
    : canMove
      ? "ArrowLeft ArrowRight"
      : undefined;
  const baselineTone =
    task.baselineStart && task.baselineEnd
      ? task.start > task.baselineStart || task.end > task.baselineEnd
        ? "delayed"
        : task.start < task.baselineStart || task.end < task.baselineEnd
          ? "ahead"
          : "same"
      : "same";
  const progressEditorId = `timeline-progress-${task.id}`;

  const handleProgressChange = (progress: number) => {
    onUpdateTask(task.id, {
      progress,
      status: normalizeProgressStatus(progress),
    });
  };

  const handleProgressEditorBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setProgressEditorOpen(false);
    }
  };

  const { handleKeyDown, handleOpenInspector, handleTaskClick, startPointerOperation } =
    useTimelineBarInteraction({
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
    });
  if (task.type === "milestone") {
    return (
      <>
        {isBaselineInVisibleRange ? (
          <div
            aria-hidden="true"
            className={`gantt-baseline ${baselineTone} milestone-baseline`}
            style={{
              left: baselineLeft + 3,
              top: top + rowHeight - 10,
              width: baselineWidth,
            }}
            title={`基準 ${formatShortDate(task.baselineStart ?? task.start)}`}
          />
        ) : null}
        <button
          aria-keyshortcuts="ArrowLeft ArrowRight"
          aria-label={`${task.title} ${formatShortDate(task.start)}。左右キーで日程を移動`}
          aria-pressed={selected}
          className={`milestone status-${task.status} ${selected ? "selected" : ""} ${
            searchMatched ? "search-match" : ""
          } ${dependencyIssues.length > 0 ? "dependency-issue" : ""}`}
          data-task-id={task.id}
          onClick={handleTaskClick}
          onContextMenu={onContextMenu}
          onDoubleClick={handleOpenInspector}
          onFocus={() => onSelect()}
          onKeyDown={handleKeyDown}
          onMouseDown={(event) => startPointerOperation(event, "move")}
          style={{ height: rowHeight, left: left + 2, top }}
          title={`${task.title} ${formatShortDate(task.start)} / ドラッグで移動 / ダブルクリックで詳細`}
          type="button"
        >
          <span />
          <em>
            {task.title} {formatShortDate(task.start)}
          </em>
        </button>
      </>
    );
  }

  return (
    <>
      {isBaselineInVisibleRange ? (
        <div
          aria-hidden="true"
          className={`gantt-baseline ${baselineTone}`}
          style={{
            left: baselineLeft,
            top: top + rowHeight - 9,
            width: baselineWidth,
          }}
          title={`基準 ${formatShortDate(task.baselineStart ?? task.start)} - ${formatShortDate(
            task.baselineEnd ?? task.end,
          )}`}
        />
      ) : null}
      <button
        aria-keyshortcuts={barKeyShortcuts}
        aria-label={`${task.title} ${formatShortDate(task.start)}から${formatShortDate(
          task.end,
        )}${barKeyboardHint}`}
        aria-pressed={selected}
        className={`gantt-bar ${task.type} ${task.hasChildren ? "has-children" : "leaf-task"} status-${task.status} ${selected ? "selected" : ""} ${
          canMove ? "draggable" : "readonly"
        } ${searchMatched ? "search-match" : ""} ${
          dependencyIssues.length > 0 ? "dependency-issue" : ""
        }`}
        data-task-id={task.id}
        onClick={handleTaskClick}
        onContextMenu={onContextMenu}
        onDoubleClick={handleOpenInspector}
        onFocus={() => onSelect()}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => startPointerOperation(event, "move")}
        style={
          {
            "--bar-color": task.color,
            left,
            top: top + barTopOffset,
            width,
          } as CSSProperties
        }
        title={`${task.title} ${formatShortDate(task.start)} - ${formatShortDate(task.end)} / ドラッグで移動 / 両端で期間変更 / ダブルクリックで詳細`}
        type="button"
      >
        {canResize ? (
          <span
            className="resize-handle start"
            onMouseDown={(event) => startPointerOperation(event, "start")}
          />
        ) : null}
        <span className="bar-progress" style={{ width: `${Math.max(task.progress, 4)}%` }} />
        <span className="bar-label">{task.title}</span>
        {canResize ? (
          <span
            className="resize-handle end"
            onMouseDown={(event) => startPointerOperation(event, "end")}
          />
        ) : null}
      </button>
      <div
        className={`bar-side-meta ${task.type}`}
        onBlur={handleProgressEditorBlur}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        style={{ left: left + width + 8, top: top + rowHeight / 2 }}
        title={metaTitle}
      >
        <button
          aria-controls={progressEditorId}
          aria-expanded={progressEditorOpen}
          aria-label={`${task.title}の進捗 ${task.progress}%`}
          className="bar-progress-trigger"
          data-progress-task-id={task.id}
          onClick={() => {
            onSelect();
            setProgressEditorOpen((open) => !open);
          }}
          type="button"
        >
          {task.progress}%
        </button>
        {assigneeMeta.short ? <span>{assigneeMeta.short}</span> : null}
        {progressEditorOpen ? (
          <div className="timeline-progress-editor" id={progressEditorId} role="dialog">
            <div>
              <span>進捗</span>
              <strong>{task.progress}%</strong>
            </div>
            <input
              aria-label={`${task.title}の進捗率`}
              max="100"
              min="0"
              onChange={(event) => handleProgressChange(Number(event.target.value))}
              step="5"
              type="range"
              value={task.progress}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function formatTimelineAssignees(assigneeIds: string[], members: Member[]) {
  const names = assigneeIds
    .map((id) => members.find((member) => member.id === id)?.name ?? id)
    .filter(Boolean);
  if (names.length === 0) {
    return { full: "", short: "" };
  }
  const visibleNames = names.slice(0, 2);
  const hiddenCount = names.length - visibleNames.length;
  return {
    full: names.join(" / "),
    short:
      hiddenCount > 0 ? `${visibleNames.join(" / ")} +${hiddenCount}` : visibleNames.join(" / "),
  };
}
