import { type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import { type DependencyIssue, taskMatchesQuery } from "../../../lib/schedule";
import type {
  GanttColumnVisibility,
  Member,
  ScheduleTask,
  TaskInspectorFocusTarget,
  TaskRow,
} from "../../../types/schedule";
import { getTaskSelectionOptions } from "../utils/taskSelection";
import { rowHeight } from "./constants";
import { TaskMetadataCells } from "./TaskMetadataCells";
import { TaskTitleCell } from "./TaskTitleCell";

type TaskTableRowProps = {
  collapsed: boolean;
  canReorder?: boolean;
  columnVisibility: GanttColumnVisibility;
  dependencyIssues: DependencyIssue[];
  dragReordering: boolean;
  members: Member[];
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDragHandlePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFocusTaskStart: () => void;
  onOpenInspector: () => void;
  onSelect: (options?: {
    additive?: boolean;
    focusTarget?: TaskInspectorFocusTarget;
    range?: boolean;
  }) => void;
  onToggle: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  query: string;
  selected: boolean;
  task: TaskRow;
  titleEditSignal?: number;
  showDates?: boolean;
};

/** 行選択を所有し、タイトルセルと編集列を同じタスクへ接続します。 */
export function TaskTableRow({
  canReorder = true,
  collapsed,
  columnVisibility,
  dependencyIssues,
  dragReordering,
  members,
  onContextMenu,
  onDragHandlePointerDown,
  onFocusTaskStart,
  onOpenInspector,
  onSelect,
  onToggle,
  onUpdateTask,
  query,
  selected,
  showDates = false,
  task,
  titleEditSignal = 0,
}: TaskTableRowProps) {
  const searchMatched = taskMatchesQuery(task, query);

  function handleRowClick(event: MouseEvent<HTMLDivElement>) {
    const selectionOptions = getTaskSelectionOptions(event);
    onSelect(selectionOptions);
    if (!selectionOptions.additive && !selectionOptions.range && event.detail === 1) {
      onFocusTaskStart();
    }
    if (event.detail < 2) {
      return;
    }
    const { target } = event;
    if (
      target instanceof Element &&
      target.closest("button, input, select, textarea, [contenteditable='true']")
    ) {
      return;
    }
    event.preventDefault();
    onOpenInspector();
  }

  return (
    <div
      className={`task-table-row ${selected ? "selected" : ""} ${
        searchMatched ? "search-match" : ""
      } ${dependencyIssues.length > 0 ? "dependency-issue" : ""} ${
        dragReordering ? "reorder-dragging" : ""
      } row-${task.type} status-${task.status}`}
      data-task-id={task.id}
      onClick={handleRowClick}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          onSelect();
          onFocusTaskStart();
        }
      }}
      role="button"
      style={{ height: rowHeight }}
      tabIndex={0}
    >
      <TaskTitleCell
        canReorder={canReorder}
        collapsed={collapsed}
        dependencyIssues={dependencyIssues}
        onDragHandlePointerDown={onDragHandlePointerDown}
        onFocusTaskStart={onFocusTaskStart}
        onSelect={onSelect}
        onToggle={onToggle}
        onUpdateTask={onUpdateTask}
        searchMatched={searchMatched}
        task={task}
        titleEditSignal={titleEditSignal}
      />
      <TaskMetadataCells
        columnVisibility={columnVisibility}
        members={members}
        onSelect={onSelect}
        onUpdateTask={onUpdateTask}
        showDates={showDates}
        task={task}
      />
    </div>
  );
}
