import { useMemo } from "react";

import { getActiveMembers } from "../../../lib/members";
import type {
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  Member,
  ScheduleFilters,
  TaskStatus,
} from "../../../types/schedule";
import { GanttDisplayControls } from "./GanttDisplayControls";
import { GanttFilterControls } from "./GanttFilterControls";
import { GanttSelectionActions } from "./GanttSelectionActions";

type GanttToolbarProps = {
  activeFilterCount: number;
  calendarAware: boolean;
  canUseTaskActions: boolean;
  columnVisibility: GanttColumnVisibility;
  displayMode: "gantt" | "table";
  filterOpen: boolean;
  filters: ScheduleFilters;
  members: Member[];
  onAssigneeChange: (assigneeId: string) => void;
  onBulkAssigneeChange: (memberId: string, taskId?: string | null) => void;
  onBulkDateShift: (deltaDays: number, taskId?: string | null) => void;
  onBulkStatusChange: (status: TaskStatus, taskId?: string | null) => void;
  onCalendarAwareChange: (enabled: boolean) => void;
  onClearSelection: () => void;
  onColumnVisibilityChange: (visibility: GanttColumnVisibility) => void;
  onCreateTask: () => void;
  onDeleteTask: () => void;
  onDisplayModeChange: (mode: "gantt" | "table") => void;
  onFilterOpenChange: (open: boolean) => void;
  onScaleChange: (scale: GanttScale) => void;
  onShortcutHelp: () => void;
  onTableSortReset: () => void;
  onTimelineNavigate: (direction: -1 | 1) => void;
  onTimeUnitChange: (unit: GanttTimeUnit) => void;
  onToday: () => void;
  scale: GanttScale;
  selectedTaskCount: number;
  tableSortKey: string | null;
  timeUnit: GanttTimeUnit;
};

/** 操作群を選択、表示、絞り込みの各コンポーネントへ振り分けます。 */
export function GanttToolbar({
  activeFilterCount,
  calendarAware,
  canUseTaskActions,
  columnVisibility,
  displayMode,
  filterOpen,
  filters,
  members,
  onAssigneeChange,
  onBulkAssigneeChange,
  onBulkDateShift,
  onBulkStatusChange,
  onCalendarAwareChange,
  onClearSelection,
  onColumnVisibilityChange,
  onCreateTask,
  onDeleteTask,
  onDisplayModeChange,
  onFilterOpenChange,
  onScaleChange,
  onShortcutHelp,
  onTableSortReset,
  onTimelineNavigate,
  onTimeUnitChange,
  onToday,
  scale,
  selectedTaskCount,
  tableSortKey,
  timeUnit,
}: GanttToolbarProps) {
  const assigneeOptions = useMemo(() => {
    const activeMembers = getActiveMembers(members);
    return activeMembers.length > 0 ? activeMembers : members;
  }, [members]);

  return (
    <div className="workbench-toolbar" data-tour="gantt-toolbar">
      <GanttSelectionActions
        assigneeOptions={assigneeOptions}
        canUseTaskActions={canUseTaskActions}
        onBulkAssigneeChange={onBulkAssigneeChange}
        onBulkDateShift={onBulkDateShift}
        onBulkStatusChange={onBulkStatusChange}
        onClearSelection={onClearSelection}
        onCreateTask={onCreateTask}
        onDeleteTask={onDeleteTask}
        selectedTaskCount={selectedTaskCount}
      />
      <GanttDisplayControls
        calendarAware={calendarAware}
        displayMode={displayMode}
        onCalendarAwareChange={onCalendarAwareChange}
        onDisplayModeChange={onDisplayModeChange}
        onScaleChange={onScaleChange}
        onTableSortReset={onTableSortReset}
        onTimelineNavigate={onTimelineNavigate}
        onTimeUnitChange={onTimeUnitChange}
        onToday={onToday}
        scale={scale}
        tableSortKey={tableSortKey}
        timeUnit={timeUnit}
      />
      <GanttFilterControls
        activeFilterCount={activeFilterCount}
        assigneeOptions={assigneeOptions}
        columnVisibility={columnVisibility}
        filterOpen={filterOpen}
        filters={filters}
        onAssigneeChange={onAssigneeChange}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onFilterOpenChange={onFilterOpenChange}
        onShortcutHelp={onShortcutHelp}
      />
    </div>
  );
}
