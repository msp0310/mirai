import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarDefinition,
  CalendarHoliday,
  Project,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import {
  addDays,
  daysInclusive,
  formatDateWithWeekday,
  formatShortDate,
  isWorkingDay,
  parseDate,
  statusLabels,
  toDateKey,
} from "../../../lib/schedule";
import { fetchJapanesePublicHolidays, mergeCalendarHolidays } from "../../../data/publicHolidays";

type CalendarPanelProps = {
  calendar: CalendarDefinition;
  onCalendarChange: (calendar: CalendarDefinition) => void;
  onSelectTask: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  project: Project;
  tasks: ScheduleTask[];
};

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

/** 稼働日・休日とタスク期間を確認するカレンダー画面です。 */
export function CalendarPanel({
  calendar,
  onCalendarChange,
  onSelectTask,
  project,
  tasks,
}: CalendarPanelProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    toDateKey(
      new Date(
        parseDate(project.rangeStart).getFullYear(),
        parseDate(project.rangeStart).getMonth(),
        1,
      ),
    ),
  );
  const [holidayDate, setHolidayDate] = useState(project.rangeStart);
  const [holidayName, setHolidayName] = useState("");
  const [holidayImportMessage, setHolidayImportMessage] = useState("");
  const [holidayImporting, setHolidayImporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(project.rangeStart);

  useEffect(() => {
    const projectStart = parseDate(project.rangeStart);
    const monthStart = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    setVisibleMonth(toDateKey(monthStart));
    setHolidayDate(project.rangeStart);
    setHolidayImportMessage("");
    setSelectedDate(project.rangeStart);
  }, [project.id, project.rangeStart]);

  const monthDate = parseDate(visibleMonth);
  const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const monthHolidays = calendar.holidays.filter((holiday) =>
    holiday.date.startsWith(visibleMonth.slice(0, 7)),
  );
  const milestones = tasks
    .filter((task) => task.type === "milestone")
    .filter((task) => task.start.startsWith(visibleMonth.slice(0, 7)));
  const workingDays = useMemo(
    () =>
      Array.from(
        { length: daysInclusive(toDateKey(monthStart), toDateKey(monthEnd)) },
        (_, index) => addDays(monthStart, index),
      ).filter((date) => isWorkingDay(date, calendar, true)).length,
    [calendar, monthStart, monthEnd],
  );
  const selectedDateObject = parseDate(selectedDate);
  const selectedHoliday = calendar.holidays.find((holiday) => holiday.date === selectedDate);
  const selectedDateEvents = getDayEvents(selectedDate);
  const selectedDateWorking = isWorkingDay(selectedDateObject, calendar, true);

  function changeMonth(offset: number) {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1);
    setVisibleMonth(toDateKey(next));
  }

  function toggleWeekday(weekday: number) {
    const exists = calendar.workWeek.includes(weekday);
    const workWeek = exists
      ? calendar.workWeek.filter((day) => day !== weekday)
      : [...calendar.workWeek, weekday].sort((a, b) => a - b);
    onCalendarChange({ ...calendar, workWeek });
  }

  function addHoliday() {
    const date = holidayDate;
    const name = holidayName.trim() || "会社休日";
    const holidays = [
      ...calendar.holidays.filter((holiday) => holiday.date !== date),
      { date, name },
    ].sort((a, b) => a.date.localeCompare(b.date));
    onCalendarChange({ ...calendar, holidays });
    setHolidayName("");
  }

  function removeHoliday(target: CalendarHoliday) {
    onCalendarChange({
      ...calendar,
      holidays: calendar.holidays.filter(
        (holiday) => holiday.date !== target.date || holiday.name !== target.name,
      ),
    });
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setHolidayDate(dateKey);
  }

  function toggleSelectedHoliday() {
    if (selectedHoliday) {
      removeHoliday(selectedHoliday);
      return;
    }
    const holidays = [...calendar.holidays, { date: selectedDate, name: "会社休日" }].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    onCalendarChange({ ...calendar, holidays });
  }

  async function importJapanesePublicHolidays() {
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
  }

  function getDayEvents(dateKey: string) {
    return tasks
      .filter((task) => task.type === "task" || task.type === "milestone")
      .filter((task) => task.start <= dateKey && task.end >= dateKey)
      .sort(
        (a, b) =>
          getCalendarEventPriority(a, dateKey) - getCalendarEventPriority(b, dateKey) ||
          a.start.localeCompare(b.start) ||
          a.title.localeCompare(b.title),
      );
  }

  function getVisibleEvents(dateKey: string) {
    return tasks
      .filter((task) => task.type === "task" || task.type === "milestone")
      .filter((task) => task.start <= dateKey && task.end >= dateKey)
      .filter((task) => task.type === "milestone" || task.start === dateKey || task.end === dateKey)
      .sort(
        (a, b) =>
          getCalendarEventPriority(a, dateKey) - getCalendarEventPriority(b, dateKey) ||
          a.start.localeCompare(b.start),
      )
      .slice(0, 3);
  }

  return (
    <section className="calendar-panel" aria-label="カレンダー管理">
      <div className="calendar-header">
        <div>
          <h2>カレンダー管理</h2>
          <span>{project.workspace} の稼働日・休日・マイルストーン</span>
        </div>
        <div className="month-switcher" aria-label="表示月">
          <button onClick={() => changeMonth(-1)} type="button" aria-label="前月">
            <ChevronLeftIcon />
          </button>
          <strong>{monthLabel}</strong>
          <button onClick={() => changeMonth(1)} type="button" aria-label="翌月">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="calendar-layout">
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
              const inMonth = date.getMonth() === monthDate.getMonth();
              const working = isWorkingDay(date, calendar, true);
              const dayEvents = getDayEvents(dateKey);
              const events = getVisibleEvents(dateKey);
              const hiddenEventCount = Math.max(dayEvents.length - events.length, 0);
              return (
                <article
                  className={`calendar-day ${inMonth ? "" : "outside"} ${
                    working ? "working" : "off"
                  } ${selectedDate === dateKey ? "selected" : ""}`}
                  key={dateKey}
                >
                  <button
                    className="calendar-day-head"
                    onClick={() => selectDate(dateKey)}
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
                        onClick={() => selectDate(dateKey)}
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

        <aside className="calendar-side">
          <div className="calendar-stat-grid">
            <Metric label="稼働日" value={`${workingDays}日`} />
            <Metric label="休日" value={`${monthHolidays.length}日`} />
            <Metric label="マイルストーン" value={`${milestones.length}件`} />
          </div>

          <section className="calendar-card selected-day-card">
            <div className="selected-day-heading">
              <h3>選択日</h3>
              <strong>{formatDateWithWeekday(selectedDate)}</strong>
              <span>
                {selectedHoliday
                  ? selectedHoliday.name
                  : selectedDateWorking
                    ? "稼働日"
                    : "非稼働日"}
              </span>
            </div>
            <button
              className={selectedHoliday ? "subtle-action danger full" : "subtle-action full"}
              onClick={toggleSelectedHoliday}
              type="button"
            >
              {selectedHoliday ? "休日を解除" : "会社休日にする"}
            </button>
            <div className="selected-day-events">
              {selectedDateEvents.map((task) => (
                <button
                  className={`selected-day-event ${task.type}`}
                  key={task.id}
                  onClick={() =>
                    onSelectTask(task.id, getCalendarEventFocusTarget(task, selectedDate))
                  }
                  type="button"
                >
                  <span>{getCalendarEventLabel(task, selectedDate)}</span>
                  <strong>{task.title}</strong>
                  <small>
                    {formatShortDate(task.start)} - {formatShortDate(task.end)} /{" "}
                    {statusLabels[task.status]}
                  </small>
                </button>
              ))}
              {selectedDateEvents.length === 0 ? (
                <p className="selected-day-empty">予定はありません</p>
              ) : null}
            </div>
          </section>

          <section className="calendar-card">
            <h3>稼働曜日</h3>
            <div className="weekday-toggle-grid">
              {weekdays.map((weekday, index) => (
                <label key={weekday}>
                  <input
                    checked={calendar.workWeek.includes(index)}
                    onChange={() => toggleWeekday(index)}
                    type="checkbox"
                  />
                  {weekday}
                </label>
              ))}
            </div>
          </section>

          <section className="calendar-card">
            <h3>休日を追加</h3>
            <button
              className="subtle-action full"
              disabled={holidayImporting}
              onClick={importJapanesePublicHolidays}
              type="button"
            >
              {holidayImporting ? "祝日を取得中" : "国民の祝日を取込"}
            </button>
            {holidayImportMessage ? (
              <p className="holiday-import-message">{holidayImportMessage}</p>
            ) : null}
            <div className="holiday-form">
              <input
                aria-label="休日の日付"
                onChange={(event) => setHolidayDate(event.target.value)}
                onInput={(event) => setHolidayDate(event.currentTarget.value)}
                type="date"
                value={holidayDate}
              />
              <input
                aria-label="休日名"
                onChange={(event) => setHolidayName(event.target.value)}
                placeholder="休日名"
                value={holidayName}
              />
              <button onClick={addHoliday} type="button">
                追加
              </button>
            </div>
          </section>

          <section className="calendar-card">
            <h3>登録済み休日</h3>
            <div className="holiday-list">
              {calendar.holidays.map((holiday) => (
                <div className="holiday-row" key={`${holiday.date}-${holiday.name}`}>
                  <span>
                    <strong>{formatShortDate(holiday.date)}</strong>
                    {holiday.name}
                  </span>
                  <button
                    aria-label={`${holiday.name}を削除`}
                    onClick={() => removeHoliday(holiday)}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function getCalendarEventPriority(task: ScheduleTask, dateKey: string) {
  if (task.type === "milestone") return 0;
  if (task.start === dateKey) return 1;
  if (task.end === dateKey) return 2;
  return 3;
}

function getCalendarEventLabel(task: ScheduleTask, dateKey: string) {
  if (task.type === "milestone") return "MS";
  if (task.start === dateKey) return "開始";
  if (task.end === dateKey) return "終了";
  return "進行";
}

function getCalendarEventFocusTarget(
  task: ScheduleTask,
  dateKey: string,
): TaskInspectorFocusTarget {
  if (task.type === "milestone" || task.start === dateKey) return "start";
  if (task.end === dateKey) return "end";
  return "title";
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="calendar-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
