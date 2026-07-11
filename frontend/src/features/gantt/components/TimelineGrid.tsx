import type { CSSProperties, KeyboardEvent, MouseEvent, RefObject } from "react";
import type {
  GanttTimeUnit,
  Member,
  TaskRow,
  TimelineColumn,
  TimelineDay,
} from "../../../types/schedule";
import type { DependencyIssue } from "../../../lib/schedule";
import {
  addDays,
  formatShortDate,
  getDateDeltaForTimeUnit,
  getTaskTimelineSpan,
  parseDate,
  taskMatchesQuery,
  toDateKey,
} from "../../../lib/schedule";
import { rowHeight } from "./constants";

type VisibleSlotWindow = {
  end: number;
  start: number;
};

type PointerMode = "move" | "start" | "end";

type TimelineGridProps = {
  dayWidth: number;
  headerRef: RefObject<HTMLDivElement | null>;
  members: Member[];
  months: TimelineColumn[];
  onBodyScroll: () => void;
  onTaskContextMenu: (taskId: string, event: MouseEvent<HTMLElement>) => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onOpenTaskInspector: (taskId: string) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelectTask: (taskId: string, options?: { additive?: boolean; range?: boolean }) => void;
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
  visibleSlotWindow: VisibleSlotWindow;
  viewportHeight: number;
  weeks: TimelineColumn[];
};

/** ガント右側のタイムラインとタスクバーを仮想化して描画します。 */
export function TimelineGrid({
  dayWidth,
  headerRef,
  members,
  months,
  onBodyScroll,
  onTaskContextMenu,
  onMoveTask,
  onOpenTaskInspector,
  onResizeTask,
  onSelectTask,
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
  const todayOffset = getExactTimelineSlotIndex(todayKey, timeline);
  const showToday = todayOffset >= visibleSlotWindow.start && todayOffset < visibleSlotWindow.end;
  const visibleMonths = getVisibleColumns(months, visibleSlotWindow);
  const visibleWeeks = getVisibleColumns(weeks, visibleSlotWindow);
  return (
    <>
      <div
        className="timeline-header"
        ref={headerRef}
        style={{ "--timeline-width": `${timelineWidth}px` } as CSSProperties}
      >
        {showToday ? (
          <div
            className="today-header-band"
            style={{ left: todayOffset * dayWidth, width: dayWidth }}
          />
        ) : null}
        <div className="month-row" style={{ width: timelineWidth }}>
          {visibleMonths.map((month) => (
            <div
              className="month-cell"
              key={month.key}
              style={{
                left: month.startIndex * dayWidth,
                width: month.span * dayWidth,
              }}
            >
              {month.label}
            </div>
          ))}
        </div>
        <div className="week-row" style={{ width: timelineWidth }}>
          {visibleWeeks.map((week) => {
            const day = timeUnit === "day" ? timeline[week.startIndex] : undefined;
            const className = [
              timeUnit === "day" ? "week-cell day-cell" : "week-cell",
              day?.holiday ? "holiday-date" : "",
              day && !day.holiday && day.isWeekend ? "weekend-date" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                className={className}
                key={week.key}
                style={{
                  left: week.startIndex * dayWidth,
                  width: week.span * dayWidth,
                }}
              >
                {week.label}
              </div>
            );
          })}
        </div>
        {showToday ? (
          <div className="today-label" style={{ left: todayOffset * dayWidth + dayWidth / 2 }}>
            今日
          </div>
        ) : null}
      </div>

      <div className="timeline-body" onScroll={onBodyScroll} ref={timelineBodyRef}>
        <div
          className="timeline-canvas"
          style={
            {
              "--day-width": `${dayWidth}px`,
              height: bodyHeight,
              width: timelineWidth,
            } as CSSProperties
          }
          data-total-slots={timeline.length}
          data-visible-slot-end={visibleSlotWindow.end}
          data-visible-slot-start={visibleSlotWindow.start}
        >
          <CalendarBackdrop
            bodyHeight={bodyHeight}
            dayWidth={dayWidth}
            days={timeline}
            todayOffset={todayOffset}
            visibleSlotWindow={visibleSlotWindow}
          />
          {rows.map((task, index) => (
            <TimelineRow
              index={rowIndexOffset + index}
              dayWidth={dayWidth}
              members={members}
              key={task.id}
              onMoveTask={onMoveTask}
              onResizeTask={onResizeTask}
              onContextMenu={(event) => onTaskContextMenu(task.id, event)}
              onOpenInspector={() => onOpenTaskInspector(task.id)}
              onSelect={(options) => onSelectTask(task.id, options)}
              dependencyIssues={dependencyIssueByTaskId.get(task.id) ?? []}
              searchMatched={taskMatchesQuery(task, query)}
              selected={selectedTaskIds.has(task.id)}
              task={task}
              timeUnit={timeUnit}
              timeline={timeline}
              visibleSlotWindow={visibleSlotWindow}
            />
          ))}
          <DependencyOverlay
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

type CalendarBackdropProps = {
  bodyHeight: number;
  dayWidth: number;
  days: TimelineDay[];
  todayOffset: number;
  visibleSlotWindow: VisibleSlotWindow;
};

function CalendarBackdrop({
  bodyHeight,
  dayWidth,
  days,
  todayOffset,
  visibleSlotWindow,
}: CalendarBackdropProps) {
  const visibleDays = days.slice(visibleSlotWindow.start, visibleSlotWindow.end);
  return (
    <div className="calendar-backdrop" style={{ height: bodyHeight }}>
      {visibleDays.map((day) => {
        const isToday = day.index === todayOffset;
        const className = [
          "day-column",
          day.isNonWorking ? "non-working" : "",
          isToday ? "today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const title = [isToday ? "今日" : "", day.holiday?.name ?? ""].filter(Boolean).join(" / ");

        return (
          <div
            className={className}
            key={day.key}
            style={{ left: day.index * dayWidth, width: dayWidth }}
            title={title}
          />
        );
      })}
    </div>
  );
}

function getExactTimelineSlotIndex(dateKey: string, timeline: TimelineDay[]): number {
  return timeline.findIndex((day) => dateKey >= day.start && dateKey <= day.end);
}

type TimelineRowProps = {
  dayWidth: number;
  index: number;
  members: Member[];
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onOpenInspector: () => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSelect: (options?: { additive?: boolean; range?: boolean }) => void;
  dependencyIssues: DependencyIssue[];
  searchMatched: boolean;
  selected: boolean;
  task: TaskRow;
  timeUnit: GanttTimeUnit;
  timeline: TimelineDay[];
  visibleSlotWindow: VisibleSlotWindow;
};

function TimelineRow({
  dayWidth,
  index,
  members,
  onMoveTask,
  onContextMenu,
  onOpenInspector,
  onResizeTask,
  onSelect,
  dependencyIssues,
  searchMatched,
  selected,
  task,
  timeUnit,
  timeline,
  visibleSlotWindow,
}: TimelineRowProps) {
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
  const sideMetaLabel = assigneeMeta.short
    ? `${task.progress}% ${assigneeMeta.short}`
    : `${task.progress}%`;
  const metaTitle = assigneeMeta.full
    ? `${task.progress}% ${assigneeMeta.full}`
    : `${task.progress}%`;
  const baselineLeft = baselineSpan ? baselineSpan.offset * dayWidth + 7 : 0;
  const baselineWidth = baselineSpan ? Math.max(baselineSpan.duration * dayWidth - 12, 10) : 0;
  const top = index * rowHeight;
  const barTopOffset = task.type === "task" ? 9 : task.type === "summary" ? 8 : 7;
  const metaTopOffset = task.type === "task" ? 10 : task.type === "summary" ? 10 : 9;
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

  function getSelectionOptions(event: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }) {
    return {
      additive: Boolean(event.ctrlKey || event.metaKey),
      range: Boolean(event.shiftKey),
    };
  }

  function startPointerOperation(event: MouseEvent<HTMLElement>, mode: PointerMode) {
    if (event.button !== 0) return;
    if (event.detail >= 2) {
      handleOpenInspector(event);
      return;
    }
    if ((mode === "move" && !canMove) || (mode !== "move" && !canResize)) {
      return;
    }
    onSelect(getSelectionOptions(event));
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget.closest(".gantt-bar, .milestone") as HTMLElement | null;
    if (!element) return;
    const canvas = element.closest(".timeline-canvas") as HTMLElement | null;
    const body = element.closest(".timeline-body") as HTMLElement | null;
    let previewElements: ReturnType<typeof ensureDragPreviewElements> | null = null;
    let autoScrollFrame: number | null = null;
    let active = false;
    const startX = event.clientX;
    const startScrollLeft = body?.scrollLeft ?? 0;
    let latestClientX = startX;
    let latestDelta = 0;
    const originalWidth = element.getBoundingClientRect().width;
    const minWidth = Math.max(dayWidth - 12, 10);
    const maxStartDelta = Math.max(span.duration - 1, 0);
    const minEndDelta = -Math.max(span.duration - 1, 0);

    const updatePreview = (deltaUnits: number) => {
      const deltaDays = getDateDeltaForTimeUnit(
        mode === "end" ? task.end : task.start,
        timeUnit,
        deltaUnits,
      );
      const nextStart = mode === "end" ? task.start : shiftDateKey(task.start, deltaDays);
      const nextEnd = mode === "start" ? task.end : shiftDateKey(task.end, deltaDays);
      const lineSlot =
        mode === "end" ? span.offset + span.duration + deltaUnits : span.offset + deltaUnits;
      const lineLeft = clamp(lineSlot, 0, timeline.length) * dayWidth;
      const label = formatDragPreviewLabel(mode, deltaUnits, timeUnit, {
        end: nextEnd,
        start: nextStart,
      });
      const previewPx = deltaUnits * dayWidth;

      element.dataset.dragPreview = label;
      if (!previewElements) return;
      previewElements.guide.style.left = `${lineLeft}px`;
      previewElements.bubble.style.left = `${lineLeft}px`;
      previewElements.bubble.style.top = `${Math.max(index * rowHeight - 32, 4)}px`;
      previewElements.bubble.textContent = label;
      updateDependencyPreviewPaths(canvas, task.id, mode, previewPx);
    };

    const beginDrag = () => {
      if (active) return;
      active = true;
      element.classList.add("is-dragging");
      previewElements = canvas ? ensureDragPreviewElements(canvas) : null;
      updatePreview(0);
    };

    const cleanup = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      window.removeEventListener("keydown", handleCancel);
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
      if (body) delete body.dataset.autoScroll;
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
      if (!active && Math.abs(rawDelta) < 5) return;
      beginDrag();
      let deltaDays = Math.round(rawDelta / dayWidth);
      if (mode === "start") {
        deltaDays = Math.min(deltaDays, maxStartDelta);
      }
      if (mode === "end") {
        deltaDays = Math.max(deltaDays, minEndDelta);
      }
      if (deltaDays === latestDelta) return;
      latestDelta = deltaDays;
      const previewPx = latestDelta * dayWidth;
      if (mode === "move") {
        element.style.transform = `translate3d(${previewPx}px, 0, 0)`;
      } else if (mode === "start") {
        element.style.transform = `translate3d(${previewPx}px, 0, 0)`;
        element.style.width = `${Math.max(originalWidth - previewPx, minWidth)}px`;
      } else {
        element.style.width = `${Math.max(originalWidth + previewPx, minWidth)}px`;
      }
      updatePreview(latestDelta);
    };

    const getAutoScrollVelocity = () => {
      if (!active || !body) return 0;
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
      if (!body) return;
      const velocity = getAutoScrollVelocity();
      if (velocity === 0) return;
      const previousScrollLeft = body.scrollLeft;
      body.scrollLeft += velocity;
      if (body.scrollLeft === previousScrollLeft) return;
      applyPointerPosition(latestClientX);
      autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = () => {
      const velocity = getAutoScrollVelocity();
      if (body) {
        if (velocity < 0) body.dataset.autoScroll = "left";
        else if (velocity > 0) body.dataset.autoScroll = "right";
        else delete body.dataset.autoScroll;
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
    const handleUp = () => {
      cleanup();
      if (!active || latestDelta === 0) return;
      if (mode === "move") {
        onMoveTask(task.id, getDateDeltaForTimeUnit(task.start, timeUnit, latestDelta));
      } else {
        onResizeTask(
          task.id,
          mode,
          getDateDeltaForTimeUnit(mode === "end" ? task.end : task.start, timeUnit, latestDelta),
        );
      }
    };
    const handleCancel = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      cleanup();
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    window.addEventListener("keydown", handleCancel);
  }

  function handleOpenInspector(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(getSelectionOptions(event));
    onOpenInspector();
  }

  function handleTaskClick(event: MouseEvent<HTMLElement>) {
    onSelect(getSelectionOptions(event));
    if (event.detail >= 2) {
      handleOpenInspector(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    if (event.shiftKey && canResize) {
      onResizeTask(task.id, "end", getDateDeltaForTimeUnit(task.end, timeUnit, delta));
    } else if (canMove) {
      onMoveTask(task.id, getDateDeltaForTimeUnit(task.start, timeUnit, delta));
    }
  }

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
          style={{ left: left + 2, top: top + 10 }}
          title={`${task.title} ${formatShortDate(task.start)}`}
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
        className={`gantt-bar ${task.type} status-${task.status} ${selected ? "selected" : ""} ${
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
        title={`${task.title} ${formatShortDate(task.start)} - ${formatShortDate(task.end)}`}
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
      <span
        className={`bar-side-meta ${task.type}`}
        style={{ left: left + width + 8, top: top + metaTopOffset }}
        title={metaTitle}
      >
        {sideMetaLabel}
      </span>
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

type DependencyOverlayProps = {
  dayWidth: number;
  dependencyIssueByTaskId: Map<string, DependencyIssue[]>;
  rowIndexOffset: number;
  rows: TaskRow[];
  timeline: TimelineDay[];
  visibleSlotWindow: VisibleSlotWindow;
};

function DependencyOverlay({
  dayWidth,
  dependencyIssueByTaskId,
  rowIndexOffset,
  rows,
  timeline,
  visibleSlotWindow,
}: DependencyOverlayProps) {
  const rowById = new Map(
    rows.map((task, index) => [task.id, { task, index: rowIndexOffset + index }]),
  );
  const paths: Array<{
    issue: boolean;
    path: string;
    sourceId: string;
    targetId: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }> = [];
  const visibleLeft = visibleSlotWindow.start * dayWidth - dayWidth;
  const visibleRight = visibleSlotWindow.end * dayWidth + dayWidth;

  rows.forEach((task, targetIndex) => {
    (task.dependencies ?? []).forEach((dependencyId) => {
      const source = rowById.get(dependencyId);
      if (!source) return;
      const sourceSpan = getTaskTimelineSpan(source.task, timeline);
      const targetSpan = getTaskTimelineSpan(task, timeline);
      const x1 = getDependencyAnchorX(source.task, sourceSpan, dayWidth, "end");
      const y1 = source.index * rowHeight + rowHeight / 2;
      const x2 = getDependencyAnchorX(task, targetSpan, dayWidth, "start");
      const y2 = (rowIndexOffset + targetIndex) * rowHeight + rowHeight / 2;
      const mid = Math.max(x1 + 16, (x1 + x2) / 2);
      const pathLeft = Math.min(x1, x2, mid);
      const pathRight = Math.max(x1, x2, mid);
      if (pathRight < visibleLeft || pathLeft > visibleRight) return;
      paths.push({
        issue: (dependencyIssueByTaskId.get(task.id) ?? []).some(
          (issue) => issue.dependency.id === dependencyId,
        ),
        path: buildDependencyPath(x1, y1, x2, y2),
        sourceId: source.task.id,
        targetId: task.id,
        x1,
        x2,
        y1,
        y2,
      });
    });
  });

  return (
    <svg className="dependency-overlay" aria-hidden="true">
      {paths.map((item, index) => (
        <path
          className={item.issue ? "dependency-warning-path" : undefined}
          data-dependency-source-id={item.sourceId}
          data-dependency-target-id={item.targetId}
          data-source-x={item.x1}
          data-source-y={item.y1}
          data-target-x={item.x2}
          data-target-y={item.y2}
          d={item.path}
          key={`${item.path}-${index}`}
        />
      ))}
    </svg>
  );
}

function buildDependencyPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const mid = Math.max(sourceX + 16, (sourceX + targetX) / 2);
  return `M ${sourceX} ${sourceY} H ${mid} V ${targetY} H ${targetX}`;
}

function getDependencyAnchorX(
  task: TaskRow,
  span: ReturnType<typeof getTaskTimelineSpan>,
  dayWidth: number,
  edge: "end" | "start",
): number {
  if (task.type === "milestone") {
    return span.offset * dayWidth + 15;
  }
  const left = span.offset * dayWidth + 7;
  const width = Math.max(span.duration * dayWidth - 12, 10);
  return edge === "start" ? left : left + width;
}

function updateDependencyPreviewPaths(
  canvas: HTMLElement | null,
  taskId: string,
  mode: PointerMode,
  previewPx: number,
) {
  if (!canvas) return;
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
      nextSourceX += mode === "start" ? 0 : previewPx;
    }
    if (path.dataset.dependencyTargetId === taskId) {
      nextTargetX += mode === "end" ? 0 : previewPx;
    }

    path.setAttribute("d", buildDependencyPath(nextSourceX, sourceY, nextTargetX, targetY));
  });
}

function resetDependencyPreviewPaths(canvas: HTMLElement | null) {
  if (!canvas) return;
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

function getVisibleColumns(
  columns: TimelineColumn[],
  visibleSlotWindow: VisibleSlotWindow,
): TimelineColumn[] {
  return columns.filter((column) => {
    const columnEnd = column.startIndex + column.span;
    return columnEnd >= visibleSlotWindow.start && column.startIndex <= visibleSlotWindow.end;
  });
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  return toDateKey(addDays(parseDate(dateKey), deltaDays));
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
  if (!canvas) return;
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
