import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GanttColumnKey,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  Member,
  ScheduleFilters,
  TaskStatus,
} from "../../../types/schedule";
import { getActiveMembers } from "../../../lib/members";
import { statusLabels } from "../../../lib/schedule";

const columnOptions: Array<{ key: GanttColumnKey; label: string }> = [
  { key: "assignee", label: "担当者" },
  { key: "status", label: "状況" },
  { key: "progress", label: "進捗" },
];

type GanttToolbarProps = {
  activeFilterCount: number;
  calendarAware: boolean;
  canUseTaskActions: boolean;
  columnVisibility: GanttColumnVisibility;
  filterOpen: boolean;
  filters: ScheduleFilters;
  members: Member[];
  onBulkAssigneeChange: (memberId: string, taskId?: string | null) => void;
  onBulkDateShift: (deltaDays: number, taskId?: string | null) => void;
  onBulkStatusChange: (status: TaskStatus, taskId?: string | null) => void;
  onCalendarAwareChange: (enabled: boolean) => void;
  onColumnVisibilityChange: (visibility: GanttColumnVisibility) => void;
  onCreateTask: () => void;
  onDeleteTask: () => void;
  onFilterOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onScaleChange: (scale: GanttScale) => void;
  onShortcutHelp: () => void;
  onTimelineNavigate: (direction: -1 | 1) => void;
  onTimeUnitChange: (unit: GanttTimeUnit) => void;
  onToday: () => void;
  scale: GanttScale;
  selectedTaskCount: number;
  timeUnit: GanttTimeUnit;
  displayMode: "gantt" | "table";
  onDisplayModeChange: (mode: "gantt" | "table") => void;
};

/** タスク操作、表示単位、検索、フィルターをまとめたツールバーです。 */
export function GanttToolbar({
  activeFilterCount,
  calendarAware,
  canUseTaskActions,
  columnVisibility,
  filterOpen,
  filters,
  members,
  onBulkAssigneeChange,
  onBulkDateShift,
  onBulkStatusChange,
  onCalendarAwareChange,
  onColumnVisibilityChange,
  onCreateTask,
  onDeleteTask,
  onFilterOpenChange,
  onQueryChange,
  onScaleChange,
  onShortcutHelp,
  onTimelineNavigate,
  onTimeUnitChange,
  onToday,
  scale,
  selectedTaskCount,
  timeUnit,
  displayMode,
  onDisplayModeChange,
}: GanttToolbarProps) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsPopoverRef = useRef<HTMLDivElement>(null);
  const assigneeOptions = useMemo(() => {
    const activeMembers = getActiveMembers(members);
    return activeMembers.length > 0 ? activeMembers : members;
  }, [members]);

  useEffect(() => {
    if (!columnsOpen) return;

    function closeWhenOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !columnsPopoverRef.current?.contains(target)) {
        setColumnsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [columnsOpen]);

  function toggleColumn(key: GanttColumnKey) {
    onColumnVisibilityChange({
      ...columnVisibility,
      [key]: !columnVisibility[key],
    });
  }

  return (
    <div className="workbench-toolbar">
      <button className="add-task" onClick={onCreateTask} title="タスク追加 (N)" type="button">
        <PlusIcon />
        タスク追加
      </button>
      {selectedTaskCount > 1 ? (
        <span className="selection-chip">{selectedTaskCount}行選択</span>
      ) : null}
      {selectedTaskCount > 0 ? (
        <div className="date-shift-control" aria-label="選択行の日付移動">
          <button
            aria-label="選択行を1日前へ移動"
            onClick={() => onBulkDateShift(-1)}
            title="1日戻す (Alt+←)"
            type="button"
          >
            <ChevronLeftIcon />
          </button>
          <span>1日</span>
          <button
            aria-label="選択行を1日後へ移動"
            onClick={() => onBulkDateShift(1)}
            title="1日進める (Alt+→)"
            type="button"
          >
            <ChevronRightIcon />
          </button>
        </div>
      ) : null}
      {selectedTaskCount > 1 ? (
        <div className="bulk-edit-control" aria-label="選択行の一括編集">
          <select
            aria-label="選択行の状態を一括変更"
            onChange={(event) => {
              if (!event.target.value) return;
              onBulkStatusChange(event.target.value as TaskStatus);
            }}
            value=""
          >
            <option value="">状態一括</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="選択行の担当者を一括変更"
            onChange={(event) => {
              if (!event.target.value) return;
              onBulkAssigneeChange(event.target.value);
            }}
            value=""
          >
            <option value="">担当一括</option>
            {assigneeOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.initials} {member.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {selectedTaskCount > 0 ? (
        <button
          className="subtle-action danger"
          disabled={!canUseTaskActions}
          onClick={onDeleteTask}
          title="選択行を削除 (Delete)"
          type="button"
        >
          <TrashIcon />
          削除
        </button>
      ) : null}
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
      {displayMode === "gantt" ? (
        <div className="time-unit-control" aria-label="表示粒度">
          {[
            ["day", "日"],
            ["week", "週"],
            ["month", "月"],
          ].map(([value, label], index) => (
            <button
              className={timeUnit === value ? "active" : ""}
              key={value}
              onClick={() => onTimeUnitChange(value as GanttTimeUnit)}
              title={`${label}単位 (${index + 1})`}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {displayMode === "gantt" ? (
        <div className="timeline-nav-control" aria-label="タイムライン移動">
          <button
            aria-label="前月へ移動"
            onClick={() => onTimelineNavigate(-1)}
            title="前月へ移動"
            type="button"
          >
            <ChevronLeftIcon />
            前月
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
            来月
            <ChevronRightIcon />
          </button>
        </div>
      ) : null}
      {displayMode === "gantt" ? (
        <div className="zoom-control" aria-label="ガント表示幅">
          {[
            ["compact", "小"],
            ["normal", "標準"],
            ["comfortable", "広"],
          ].map(([value, label]) => (
            <button
              className={scale === value ? "active" : ""}
              key={value}
              onClick={() => onScaleChange(value as GanttScale)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {displayMode === "gantt" ? (
        <label className="calendar-toggle">
          <input
            checked={calendarAware}
            onChange={(event) => onCalendarAwareChange(event.target.checked)}
            type="checkbox"
          />
          休日を考慮
        </label>
      ) : null}
      <div className="toolbar-popover-wrap" ref={columnsPopoverRef}>
        <button
          aria-controls="gantt-column-settings"
          aria-expanded={columnsOpen}
          className={columnsOpen ? "subtle-action active" : "subtle-action"}
          onClick={() => setColumnsOpen((open) => !open)}
          title="表示列"
          type="button"
        >
          <ViewColumnsIcon />列
        </button>
        {columnsOpen ? (
          <div className="column-settings-popover" id="gantt-column-settings">
            <strong>表示列</strong>
            {columnOptions.map((option) => (
              <label key={option.key}>
                <input
                  checked={columnVisibility[option.key]}
                  onChange={() => toggleColumn(option.key)}
                  type="checkbox"
                />
                {option.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <div className="toolbar-spacer" />
      <div className="toolbar-search-actions">
        <div className="search-box">
          <MagnifyingGlassIcon />
          <input
            aria-label="タスク検索"
            data-command="task-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="タスク検索"
            title="タスク検索 (/)"
            value={filters.query}
          />
        </div>
        <button
          className={filterOpen ? "filter-button active" : "filter-button"}
          onClick={() => onFilterOpenChange(!filterOpen)}
          title="フィルター (F)"
          type="button"
        >
          <FunnelIcon />
          フィルター
          <span>{activeFilterCount}</span>
        </button>
        <button
          className="icon-button"
          aria-label="ショートカット"
          onClick={onShortcutHelp}
          title="ショートカット (?)"
          type="button"
        >
          <QuestionMarkCircleIcon />
        </button>
      </div>
    </div>
  );
}
