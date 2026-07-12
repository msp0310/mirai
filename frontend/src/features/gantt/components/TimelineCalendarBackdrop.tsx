import type { TimelineDay } from "../../../types/schedule";
import type { VisibleTimelineSlotWindow } from "../types/ganttState";

type TimelineCalendarBackdropProps = {
  bodyHeight: number;
  dayWidth: number;
  days: TimelineDay[];
  projectRangeEnd: string;
  projectRangeStart: string;
  todayKey: string;
  visibleSlotWindow: VisibleTimelineSlotWindow;
};

/** 休日、今日、当初計画範囲外をタイムライン背景へ反映します。 */
export function TimelineCalendarBackdrop({
  bodyHeight,
  dayWidth,
  days,
  projectRangeEnd,
  projectRangeStart,
  todayKey,
  visibleSlotWindow,
}: TimelineCalendarBackdropProps) {
  const visibleDays = days.slice(visibleSlotWindow.start, visibleSlotWindow.end);
  return (
    <div className="calendar-backdrop" style={{ height: bodyHeight }}>
      {visibleDays.map((day) => {
        const isToday = todayKey >= day.start && todayKey <= day.end;
        const isOutsideProjectRange = day.end < projectRangeStart || day.start > projectRangeEnd;
        const includesProjectEnd = projectRangeEnd >= day.start && projectRangeEnd <= day.end;
        const className = [
          "day-column",
          day.isNonWorking ? "non-working" : "",
          isToday ? "today" : "",
          isOutsideProjectRange ? "outside-project-range" : "",
          includesProjectEnd ? "project-range-end" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const title = [
          isToday ? "今日" : "",
          day.holiday?.name ?? "",
          isOutsideProjectRange ? "当初計画期間外" : "",
          includesProjectEnd ? "当初計画の終了" : "",
        ]
          .filter(Boolean)
          .join(" / ");

        return (
          <div
            aria-hidden="true"
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
