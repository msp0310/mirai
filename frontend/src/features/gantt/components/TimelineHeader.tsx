import type { CSSProperties, RefObject } from "react";

import { formatShortDate } from "../../../lib/schedule";
import type { GanttTimeUnit, TimelineColumn, TimelineDay } from "../../../types/schedule";
import type { VisibleTimelineSlotWindow } from "../types/ganttState";

type TimelineHeaderProps = {
  dayWidth: number;
  headerRef: RefObject<HTMLDivElement | null>;
  months: TimelineColumn[];
  projectRangeEnd: string;
  timeUnit: GanttTimeUnit;
  timeline: TimelineDay[];
  todayKey: string;
  visibleSlotWindow: VisibleTimelineSlotWindow;
  weeks: TimelineColumn[];
};

/** 表示範囲に入る月・週・日と今日、当初終了日を描画します。 */
export function TimelineHeader({
  dayWidth,
  headerRef,
  months,
  projectRangeEnd,
  timeUnit,
  timeline,
  todayKey,
  visibleSlotWindow,
  weeks,
}: TimelineHeaderProps) {
  const timelineWidth = timeline.length * dayWidth;
  const todayOffset = getExactTimelineSlotIndex(todayKey, timeline);
  const projectEndOffset = getExactTimelineSlotIndex(projectRangeEnd, timeline);
  const showToday = todayOffset >= visibleSlotWindow.start && todayOffset < visibleSlotWindow.end;
  const visibleMonths = getVisibleColumns(months, visibleSlotWindow);
  const visibleWeeks = getVisibleColumns(weeks, visibleSlotWindow);

  return (
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
      {projectEndOffset >= visibleSlotWindow.start && projectEndOffset < visibleSlotWindow.end ? (
        <div
          aria-label={`当初計画の終了日 ${formatShortDate(projectRangeEnd)}`}
          className="project-range-end-header"
          style={{ left: (projectEndOffset + 1) * dayWidth }}
          title={`当初計画の終了日 ${formatShortDate(projectRangeEnd)}`}
        />
      ) : null}
      <div className="month-row" style={{ width: timelineWidth }}>
        {visibleMonths.map((month) => (
          <div
            className="month-cell"
            key={month.key}
            style={{ left: month.startIndex * dayWidth, width: month.span * dayWidth }}
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
              style={{ left: week.startIndex * dayWidth, width: week.span * dayWidth }}
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
  );
}

export function getExactTimelineSlotIndex(dateKey: string, timeline: TimelineDay[]): number {
  return timeline.findIndex((day) => dateKey >= day.start && dateKey <= day.end);
}

function getVisibleColumns(
  columns: TimelineColumn[],
  visibleSlotWindow: VisibleTimelineSlotWindow,
) {
  return columns.filter((column) => {
    const columnEnd = column.startIndex + column.span;
    return columnEnd >= visibleSlotWindow.start && column.startIndex <= visibleSlotWindow.end;
  });
}
