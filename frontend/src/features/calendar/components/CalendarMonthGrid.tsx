import { isWorkingDay, toDateKey } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import {
  getCalendarDayEvents,
  getCalendarEventFocusTarget,
  getCalendarEventLabel,
  getVisibleCalendarEvents,
  weekdays,
} from "../model/calendarView";

type CalendarMonthGridProps = {
  calendar: CalendarDefinition;
  cells: Date[];
  monthDate: Date;
  onSelectDate: (dateKey: string) => void;
  onSelectTask: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  selectedDate: string;
  tasks: ScheduleTask[];
};

/** 月の42日グリッドと、開始・終了・マイルストーンの短縮表示を描画します。 */
export function CalendarMonthGrid({
  calendar,
  cells,
  monthDate,
  onSelectDate,
  onSelectTask,
  selectedDate,
  tasks,
}: CalendarMonthGridProps) {
  return (
    <div className="calendar-main">
      <div className="calendar-weekdays">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((date) => {
          const dateKey = toDateKey(date);
          const holiday = calendar.holidays.find((item) => item.date === dateKey);
          const events = getVisibleCalendarEvents(tasks, dateKey);
          const hiddenEventCount = Math.max(
            getCalendarDayEvents(tasks, dateKey).length - events.length,
            0,
          );
          return (
            <article
              className={`calendar-day ${date.getMonth() === monthDate.getMonth() ? "" : "outside"} ${
                isWorkingDay(date, calendar, true) ? "working" : "off"
              } ${selectedDate === dateKey ? "selected" : ""}`}
              key={dateKey}
            >
              <button
                className="calendar-day-head"
                onClick={() => onSelectDate(dateKey)}
                type="button"
              >
                <strong>{date.getDate()}</strong>
                {holiday ? <span>{holiday.name}</span> : null}
              </button>
              <div className="calendar-events">
                {events.map((task) => (
                  <button
                    className={`calendar-event ${task.type}`}
                    key={task.id}
                    onClick={() =>
                      onSelectTask(task.id, getCalendarEventFocusTarget(task, dateKey))
                    }
                    title={`${getCalendarEventLabel(task, dateKey)}: ${task.title}`}
                    type="button"
                  >
                    <span>{getCalendarEventLabel(task, dateKey)}</span>
                    {task.title}
                  </button>
                ))}
                {hiddenEventCount > 0 ? (
                  <button
                    className="calendar-event more"
                    onClick={() => onSelectDate(dateKey)}
                    type="button"
                  >
                    +{hiddenEventCount}件
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
