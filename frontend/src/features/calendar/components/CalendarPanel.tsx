import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import type {
  CalendarDefinition,
  Project,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import { useCalendarPanel } from "../hooks/useCalendarPanel";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarSidebar } from "./CalendarSidebar";

type CalendarPanelProps = {
  calendar: CalendarDefinition;
  onCalendarChange: (calendar: CalendarDefinition) => void;
  onSelectTask: (taskId: string, focusTarget?: TaskInspectorFocusTarget) => void;
  project: Project;
  tasks: ScheduleTask[];
};

/** 月グリッドと休日・稼働日編集を共通のカレンダー状態で構成します。 */
export function CalendarPanel({
  calendar,
  onCalendarChange,
  onSelectTask,
  project,
  tasks,
}: CalendarPanelProps) {
  const model = useCalendarPanel({ calendar, onCalendarChange, project, tasks });

  return (
    <section className="calendar-panel" aria-label="カレンダー管理">
      <div className="calendar-header">
        <div>
          <h2>カレンダー管理</h2>
          <span>{project.workspace} の稼働日・休日・マイルストーン</span>
        </div>
        <div className="month-switcher" aria-label="表示月">
          <button aria-label="前月" onClick={() => model.changeMonth(-1)} type="button">
            <ChevronLeftIcon />
          </button>
          <strong>{model.monthLabel}</strong>
          <button aria-label="翌月" onClick={() => model.changeMonth(1)} type="button">
            <ChevronRightIcon />
          </button>
          <button className="month-today-button" onClick={model.goToToday} type="button">
            今日
          </button>
          <input
            aria-label="表示日"
            onChange={(event) => model.selectDate(event.target.value)}
            type="date"
            value={model.selectedDate}
          />
        </div>
      </div>
      <div className="calendar-date-strip" aria-label="選択日前後の日付">
        {model.dateStrip.map((item) => (
          <button
            className={`${item.selected ? "selected" : ""} ${item.working ? "working" : "off"}`}
            key={item.dateKey}
            onClick={() => model.selectDate(item.dateKey)}
            type="button"
          >
            <span>{item.weekday}</span>
            <strong>
              {item.month}/{item.day}
            </strong>
            <small>{item.eventCount > 0 ? `${item.eventCount}件` : item.working ? "稼働" : "休み"}</small>
          </button>
        ))}
      </div>
      <div className="calendar-layout">
        <CalendarMonthGrid
          calendar={calendar}
          cells={model.cells}
          monthDate={model.monthDate}
          onSelectDate={model.selectDate}
          onSelectTask={onSelectTask}
          selectedDate={model.selectedDate}
          tasks={tasks}
        />
        <CalendarSidebar
          calendar={calendar}
          holidayDate={model.holidayDate}
          holidayImporting={model.holidayImporting}
          holidayImportMessage={model.holidayImportMessage}
          holidayName={model.holidayName}
          milestonesCount={model.milestones.length}
          monthHolidayCount={model.monthHolidays.length}
          onAddHoliday={model.addHoliday}
          onHolidayDateChange={model.setHolidayDate}
          onHolidayNameChange={model.setHolidayName}
          onImportHolidays={model.importJapanesePublicHolidays}
          onRemoveHoliday={model.removeHoliday}
          onSelectTask={onSelectTask}
          onToggleSelectedHoliday={model.toggleSelectedHoliday}
          onToggleWeekday={model.toggleWeekday}
          selectedDate={model.selectedDate}
          selectedDateEvents={model.selectedDateEvents}
          selectedDateWorking={model.selectedDateWorking}
          selectedHoliday={model.selectedHoliday}
          workingDays={model.workingDays}
        />
      </div>
    </section>
  );
}
