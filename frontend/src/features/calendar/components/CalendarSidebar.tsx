import { TrashIcon } from "@heroicons/react/24/outline";

import { formatDateWithWeekday, formatShortDate, statusLabels } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  CalendarHoliday,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import {
  getCalendarEventFocusTarget,
  getCalendarEventLabel,
  weekdays,
} from "../model/calendarView";

type CalendarSidebarProps = {
  calendar: CalendarDefinition;
  holidayDate: string;
  holidayImporting: boolean;
  holidayImportMessage: string;
  holidayName: string;
  milestonesCount: number;
  monthHolidayCount: number;
  onAddHoliday: () => void;
  onHolidayDateChange: (value: string) => void;
  onHolidayNameChange: (value: string) => void;
  onImportHolidays: () => void;
  onRemoveHoliday: (holiday: CalendarHoliday) => void;
  onSelectTask: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  onToggleSelectedHoliday: () => void;
  onToggleWeekday: (weekday: number) => void;
  selectedDate: string;
  selectedDateEvents: ScheduleTask[];
  selectedDateWorking: boolean;
  selectedHoliday?: CalendarHoliday;
  workingDays: number;
};

/** 選択日、稼働曜日、休日マスターを月グリッドの補助領域として表示します。 */
export function CalendarSidebar(props: CalendarSidebarProps) {
  return (
    <aside className="calendar-side">
      <div className="calendar-stat-grid">
        <Metric label="稼働日" value={`${props.workingDays}日`} />
        <Metric label="休日" value={`${props.monthHolidayCount}日`} />
        <Metric label="マイルストーン" value={`${props.milestonesCount}件`} />
      </div>
      <section className="calendar-card selected-day-card">
        <div className="selected-day-heading">
          <h3>選択日</h3>
          <strong>{formatDateWithWeekday(props.selectedDate)}</strong>
          <span>
            {props.selectedHoliday?.name ?? (props.selectedDateWorking ? "稼働日" : "非稼働日")}
          </span>
        </div>
        <button
          className={props.selectedHoliday ? "subtle-action danger full" : "subtle-action full"}
          onClick={props.onToggleSelectedHoliday}
          type="button"
        >
          {props.selectedHoliday ? "休日を解除" : "会社休日にする"}
        </button>
        <div className="selected-day-events">
          {props.selectedDateEvents.map((task) => (
            <button
              className={`selected-day-event ${task.type}`}
              key={task.id}
              onClick={() =>
                props.onSelectTask(task.id, getCalendarEventFocusTarget(task, props.selectedDate))
              }
              type="button"
            >
              <span>{getCalendarEventLabel(task, props.selectedDate)}</span>
              <strong>{task.title}</strong>
              <small>
                {formatShortDate(task.start)} - {formatShortDate(task.end)} /{" "}
                {statusLabels[task.status]}
              </small>
            </button>
          ))}
          {props.selectedDateEvents.length === 0 ? (
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
                checked={props.calendar.workWeek.includes(index)}
                onChange={() => props.onToggleWeekday(index)}
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
          disabled={props.holidayImporting}
          onClick={props.onImportHolidays}
          type="button"
        >
          {props.holidayImporting ? "祝日を取得中" : "国民の祝日を取込"}
        </button>
        {props.holidayImportMessage ? (
          <p className="holiday-import-message">{props.holidayImportMessage}</p>
        ) : null}
        <div className="holiday-form">
          <input
            aria-label="休日の日付"
            onChange={(event) => props.onHolidayDateChange(event.target.value)}
            onInput={(event) => props.onHolidayDateChange(event.currentTarget.value)}
            type="date"
            value={props.holidayDate}
          />
          <input
            aria-label="休日名"
            onChange={(event) => props.onHolidayNameChange(event.target.value)}
            placeholder="休日名"
            value={props.holidayName}
          />
          <button onClick={props.onAddHoliday} type="button">
            追加
          </button>
        </div>
      </section>
      <section className="calendar-card">
        <h3>登録済み休日</h3>
        <div className="holiday-list">
          {props.calendar.holidays.map((holiday) => (
            <div className="holiday-row" key={`${holiday.date}-${holiday.name}`}>
              <span>
                <strong>{formatShortDate(holiday.date)}</strong>
                {holiday.name}
              </span>
              <button
                aria-label={`${holiday.name}を削除`}
                onClick={() => props.onRemoveHoliday(holiday)}
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="calendar-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
