import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import type { GanttScale, GanttTimeUnit } from "../../../types/schedule";

type GanttDisplayControlsProps = {
  calendarAware: boolean;
  displayMode: "gantt" | "table";
  onCalendarAwareChange: (enabled: boolean) => void;
  onDisplayModeChange: (mode: "gantt" | "table") => void;
  onScaleChange: (scale: GanttScale) => void;
  onTableSortReset: () => void;
  onTimelineNavigate: (direction: -1 | 1) => void;
  onTimeUnitChange: (unit: GanttTimeUnit) => void;
  onToday: () => void;
  scale: GanttScale;
  tableSortKey: string | null;
  timeUnit: GanttTimeUnit;
};

/** 表示モード、時間粒度、移動、表示幅、休日考慮をまとめます。 */
export function GanttDisplayControls({
  calendarAware,
  displayMode,
  onCalendarAwareChange,
  onDisplayModeChange,
  onScaleChange,
  onTableSortReset,
  onTimelineNavigate,
  onTimeUnitChange,
  onToday,
  scale,
  tableSortKey,
  timeUnit,
}: GanttDisplayControlsProps) {
  return (
    <>
      <div className="view-mode-control" aria-label="タスク表示">
        <button
          className={displayMode === "gantt" ? "active" : ""}
          onClick={() => onDisplayModeChange("gantt")}
          type="button"
        >
          ガント
        </button>
        <button
          className={displayMode === "table" ? "active" : ""}
          onClick={() => onDisplayModeChange("table")}
          type="button"
        >
          表
        </button>
      </div>
      {displayMode === "table" ? (
        <button
          className="subtle-action table-sort-reset"
          disabled={tableSortKey === null}
          onClick={onTableSortReset}
          title="元の階層順に戻す"
          type="button"
        >
          階層順
        </button>
      ) : null}
      {displayMode === "gantt" ? (
        <>
          <div className="time-unit-control" aria-label="表示粒度">
            {(["day", "week", "month"] as const).map((value, index) => {
              const label = value === "day" ? "日" : value === "week" ? "週" : "月";
              return (
                <button
                  className={timeUnit === value ? "active" : ""}
                  key={value}
                  onClick={() => onTimeUnitChange(value)}
                  title={`${label}単位 (${index + 1})`}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="timeline-nav-control" aria-label="タイムライン移動">
            <button
              aria-label="前月へ移動"
              onClick={() => onTimelineNavigate(-1)}
              title="前月へ移動"
              type="button"
            >
              <ChevronLeftIcon />
              <span className="timeline-nav-label">前月</span>
            </button>
            <button
              aria-label="今日へ移動"
              className="today-jump"
              onClick={onToday}
              title="今日へ移動 (T)"
              type="button"
            >
              今日
            </button>
            <button
              aria-label="来月へ移動"
              onClick={() => onTimelineNavigate(1)}
              title="来月へ移動"
              type="button"
            >
              <span className="timeline-nav-label">来月</span>
              <ChevronRightIcon />
            </button>
          </div>
          <div className="zoom-control" aria-label="ガント表示幅">
            {(["compact", "normal", "comfortable"] as const).map((value) => (
              <button
                className={scale === value ? "active" : ""}
                key={value}
                onClick={() => onScaleChange(value)}
                type="button"
              >
                {value === "compact" ? "小" : value === "normal" ? "標準" : "広"}
              </button>
            ))}
          </div>
          <label className="calendar-toggle" title="休日を考慮して工数と期間を計算">
            <input
              checked={calendarAware}
              onChange={(event) => onCalendarAwareChange(event.target.checked)}
              type="checkbox"
            />
            <span className="calendar-toggle-label">休日を考慮</span>
          </label>
        </>
      ) : null}
    </>
  );
}
