import { useEffect, useMemo, useState } from "react";

import { fetchJapanesePublicHolidays, mergeCalendarHolidays } from "../../../data/publicHolidays";
import { isWorkingDay, parseDate, toDateKey } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  CalendarHoliday,
  Project,
  ScheduleTask,
} from "../../../types/schedule";
import {
  buildCalendarMonthCells,
  countWorkingDaysInMonth,
  getCalendarDayEvents,
} from "../model/calendarView";

type UseCalendarPanelOptions = {
  calendar: CalendarDefinition;
  onCalendarChange: (calendar: CalendarDefinition) => void;
  project: Project;
  tasks: ScheduleTask[];
};

/** カレンダーの月・日選択と、稼働曜日・休日編集を管理します。 */
export function useCalendarPanel({
  calendar,
  onCalendarChange,
  project,
  tasks,
}: UseCalendarPanelOptions) {
  const [visibleMonth, setVisibleMonth] = useState(() => getProjectMonthStart(project));
  const [holidayDate, setHolidayDate] = useState(project.rangeStart);
  const [holidayName, setHolidayName] = useState("");
  const [holidayImportMessage, setHolidayImportMessage] = useState("");
  const [holidayImporting, setHolidayImporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(project.rangeStart);

  useEffect(() => {
    setVisibleMonth(getProjectMonthStart(project));
    setHolidayDate(project.rangeStart);
    setHolidayImportMessage("");
    setSelectedDate(project.rangeStart);
  }, [project.id, project.rangeStart]);

  const monthDate = parseDate(visibleMonth);
  const cells = useMemo(() => buildCalendarMonthCells(monthDate), [visibleMonth]);
  const selectedHoliday = calendar.holidays.find((holiday) => holiday.date === selectedDate);
  const selectedDateEvents = useMemo(
    () => getCalendarDayEvents(tasks, selectedDate),
    [selectedDate, tasks],
  );

  function removeHoliday(target: CalendarHoliday) {
    onCalendarChange({
      ...calendar,
      holidays: calendar.holidays.filter(
        (holiday) => holiday.date !== target.date || holiday.name !== target.name,
      ),
    });
  }

  return {
    addHoliday: () => {
      const name = holidayName.trim() || "会社休日";
      onCalendarChange({
        ...calendar,
        holidays: [
          ...calendar.holidays.filter((holiday) => holiday.date !== holidayDate),
          { date: holidayDate, name },
        ].toSorted((left, right) => left.date.localeCompare(right.date)),
      });
      setHolidayName("");
    },
    calendar,
    cells,
    changeMonth: (offset: number) => {
      const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1);
      setVisibleMonth(toDateKey(next));
    },
    holidayDate,
    holidayImporting,
    holidayImportMessage,
    holidayName,
    importJapanesePublicHolidays: async () => {
      setHolidayImporting(true);
      setHolidayImportMessage("");
      try {
        const imported = await fetchJapanesePublicHolidays(project.rangeStart, project.rangeEnd);
        const result = mergeCalendarHolidays(calendar.holidays, imported);
        onCalendarChange({ ...calendar, holidays: result.holidays });
        setHolidayImportMessage(
          `国民の祝日 ${result.importedCount}件を取得 / ${result.addedCount}件を追加`,
        );
      } catch (error) {
        setHolidayImportMessage(
          error instanceof Error ? error.message : "祝日データを取得できませんでした。",
        );
      } finally {
        setHolidayImporting(false);
      }
    },
    milestones: tasks.filter(
      (task) => task.type === "milestone" && task.start.startsWith(visibleMonth.slice(0, 7)),
    ),
    monthDate,
    monthHolidays: calendar.holidays.filter((holiday) =>
      holiday.date.startsWith(visibleMonth.slice(0, 7)),
    ),
    monthLabel: `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`,
    removeHoliday,
    selectDate: (dateKey: string) => {
      setSelectedDate(dateKey);
      setHolidayDate(dateKey);
    },
    selectedDate,
    selectedDateEvents,
    selectedDateWorking: isWorkingDay(parseDate(selectedDate), calendar, true),
    selectedHoliday,
    setHolidayDate,
    setHolidayName,
    toggleSelectedHoliday: () => {
      if (selectedHoliday) {
        removeHoliday(selectedHoliday);
        return;
      }
      onCalendarChange({
        ...calendar,
        holidays: [...calendar.holidays, { date: selectedDate, name: "会社休日" }].toSorted(
          (left, right) => left.date.localeCompare(right.date),
        ),
      });
    },
    toggleWeekday: (weekday: number) => {
      const exists = calendar.workWeek.includes(weekday);
      onCalendarChange({
        ...calendar,
        workWeek: exists
          ? calendar.workWeek.filter((day) => day !== weekday)
          : [...calendar.workWeek, weekday].toSorted((left, right) => left - right),
      });
    },
    workingDays: countWorkingDaysInMonth(monthDate, calendar),
  };
}

function getProjectMonthStart(project: Project) {
  const projectStart = parseDate(project.rangeStart);
  return toDateKey(new Date(projectStart.getFullYear(), projectStart.getMonth(), 1));
}
