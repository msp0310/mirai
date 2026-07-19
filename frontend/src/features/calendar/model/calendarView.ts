import { addDays, isWorkingDay, parseDate, toDateKey } from "../../../lib/schedule.ts";
import type {
  CalendarDefinition,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";

export const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export function buildCalendarMonthCells(monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getCalendarDayEvents(tasks: ScheduleTask[], dateKey: string) {
  return tasks
    .filter((task) => task.type === "task" || task.type === "milestone")
    .filter((task) => task.start <= dateKey && task.end >= dateKey)
    .toSorted(
      (left, right) =>
        getCalendarEventPriority(left, dateKey) - getCalendarEventPriority(right, dateKey) ||
        left.start.localeCompare(right.start) ||
        left.title.localeCompare(right.title),
    );
}

export function getVisibleCalendarEvents(tasks: ScheduleTask[], dateKey: string) {
  return getCalendarDayEvents(tasks, dateKey)
    .filter((task) => task.type === "milestone" || task.start === dateKey || task.end === dateKey)
    .slice(0, 3);
}

export function buildCalendarDateStrip(
  selectedDate: string,
  tasks: ScheduleTask[],
  calendar: CalendarDefinition,
) {
  const centerDate = parseDate(selectedDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(centerDate, index - 3);
    const dateKey = toDateKey(date);
    return {
      dateKey,
      day: date.getDate(),
      eventCount: getCalendarDayEvents(tasks, dateKey).length,
      month: date.getMonth() + 1,
      selected: dateKey === selectedDate,
      weekday: weekdays[date.getDay()],
      working: isWorkingDay(date, calendar, true),
    };
  });
}

export function getCalendarEventLabel(task: ScheduleTask, dateKey: string) {
  if (task.type === "milestone") {
    return "MS";
  }
  if (task.start === dateKey) {
    return "開始";
  }
  if (task.end === dateKey) {
    return "終了";
  }
  return "進行";
}

export function getCalendarEventFocusTarget(
  task: ScheduleTask,
  dateKey: string,
): TaskInspectorFocusTarget {
  if (task.type === "milestone" || task.start === dateKey) {
    return "start";
  }
  if (task.end === dateKey) {
    return "end";
  }
  return "title";
}

export function countWorkingDaysInMonth(monthDate: Date, calendar: CalendarDefinition) {
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  let count = 0;
  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    if (
      isWorkingDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), day), calendar, true)
    ) {
      count += 1;
    }
  }
  return count;
}

function getCalendarEventPriority(task: ScheduleTask, dateKey: string) {
  if (task.type === "milestone") {
    return 0;
  }
  if (task.start === dateKey) {
    return 1;
  }
  if (task.end === dateKey) {
    return 2;
  }
  return 3;
}
