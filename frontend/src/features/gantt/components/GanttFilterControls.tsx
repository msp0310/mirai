import {
  FunnelIcon,
  QuestionMarkCircleIcon,
  UserIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

import type {
  GanttColumnKey,
  GanttColumnVisibility,
  Member,
  ScheduleFilters,
} from "../../../types/schedule";

const columnOptions: { key: GanttColumnKey; label: string }[] = [
  { key: "assignee", label: "担当者" },
  { key: "status", label: "状況" },
  { key: "progress", label: "進捗" },
];

type GanttFilterControlsProps = {
  activeFilterCount: number;
  assigneeOptions: Member[];
  columnVisibility: GanttColumnVisibility;
  filterOpen: boolean;
  filters: ScheduleFilters;
  onAssigneeChange: (assigneeId: string) => void;
  onColumnVisibilityChange: (visibility: GanttColumnVisibility) => void;
  onFilterOpenChange: (open: boolean) => void;
  onShortcutHelp: () => void;
};

/** 列設定、担当者絞り込み、詳細フィルター、ヘルプ導線を表示します。 */
export function GanttFilterControls({
  activeFilterCount,
  assigneeOptions,
  columnVisibility,
  filterOpen,
  filters,
  onAssigneeChange,
  onColumnVisibilityChange,
  onFilterOpenChange,
  onShortcutHelp,
}: GanttFilterControlsProps) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) {
      return;
    }
    function closeWhenOutside(event: PointerEvent) {
      if (event.target instanceof Node && !columnsPopoverRef.current?.contains(event.target)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [columnsOpen]);

  function toggleColumn(key: GanttColumnKey) {
    onColumnVisibilityChange({ ...columnVisibility, [key]: !columnVisibility[key] });
  }

  return (
    <>
      <div className="toolbar-popover-wrap" ref={columnsPopoverRef}>
        <button
          aria-controls="gantt-column-settings"
          aria-expanded={columnsOpen}
          className={columnsOpen ? "subtle-action active" : "subtle-action"}
          onClick={() => setColumnsOpen((open) => !open)}
          title="表示列"
          type="button"
        >
          <ViewColumnsIcon />
          <span className="toolbar-button-label">列</span>
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
        <label className="assignee-quick-filter" title="担当者で絞り込み (/) ">
          <UserIcon />
          <select
            aria-label="担当者フィルター"
            data-command="assignee-filter"
            onChange={(event) => onAssigneeChange(event.target.value)}
            value={filters.assigneeId}
          >
            <option value="all">すべての担当者</option>
            <option value="unassigned">未割当</option>
            {assigneeOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={filterOpen ? "filter-button active" : "filter-button"}
          onClick={() => onFilterOpenChange(!filterOpen)}
          title="フィルター (F)"
          type="button"
        >
          <FunnelIcon />
          <span className="toolbar-button-label">フィルター</span>
          <span className="filter-count">{activeFilterCount}</span>
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
    </>
  );
}
