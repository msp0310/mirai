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
  buildCalendarDateStrip,
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
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(getInitialDate(project)));
  const [holidayDate, setHolidayDate] = useState(() => getInitialDate(project));
  const [holidayName, setHolidayName] = useState("");
  const [holidayImportMessage, setHolidayImportMessage] = useState("");
  const [holidayImporting, setHolidayImporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getInitialDate(project));

  useEffect(() => {
    const initialDate = getInitialDate(project);
    setVisibleMonth(getMonthStart(initialDate));
    setHolidayDate(initialDate);
    setHolidayImportMessage("");
    setSelectedDate(initialDate);
  }, [project.id, project.rangeEnd, project.rangeStart]);

  const monthDate = parseDate(visibleMonth);
  const cells = useMemo(() => buildCalendarMonthCells(monthDate), [visibleMonth]);
  const selectedHoliday = calendar.holidays.find((holiday) => holiday.date === selectedDate);
  const selectedDateEvents = useMemo(
    () => getCalendarDayEvents(tasks, selectedDate),
    [selectedDate, tasks],
  );
  const dateStrip = useMemo(
    () => buildCalendarDateStrip(selectedDate, tasks, calendar),
    [calendar, selectedDate, tasks],
  );

  function selectDate(dateKey: string) {
    if (!dateKey) {
      return;
    }
    setSelectedDate(dateKey);
    setHolidayDate(dateKey);
    setVisibleMonth(getMonthStart(dateKey));
  }

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
      selectDate(toDateKey(next));
    },
    dateStrip,
    goToToday: () => selectDate(toDateKey(new Date())),
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
    selectDate,
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

function getInitialDate(project: Project) {
  const today = toDateKey(new Date());
  return today >= project.rangeStart && today <= project.rangeEnd ? today : project.rangeStart;
}

function getMonthStart(dateKey: string) {
  const date = parseDate(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}
