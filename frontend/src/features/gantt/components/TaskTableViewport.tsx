import type {
  CSSProperties,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  UIEventHandler,
} from "react";

import type { DependencyIssue } from "../../../lib/schedule";
import type {
  GanttColumnVisibility,
  Member,
  ScheduleTask,
  TaskInspectorFocusTarget,
  TaskRow,
} from "../../../types/schedule";
import type { TaskRowReorderState, TaskTableSortKey } from "../types/ganttState";
import { TaskTableRow } from "./TaskTableRow";

type TaskTableViewportProps = {
  collapsedIds: Set<string>;
  columnVisibility: GanttColumnVisibility;
  dependencyIssueByTaskId: Map<string, DependencyIssue[]>;
  displayMode: "gantt" | "table";
  dragSelectionBox: { height: number; top: number } | null;
  onClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (taskId: string, event: MouseEvent<HTMLElement>) => void;
  onDragHandlePointerDown: (
    taskId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onFocusTaskStart: (taskId: string) => void;
  onOpenTaskInspector: (taskId: string) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  onSelectTask: (
    taskId: string,
    options?: {
      additive?: boolean;
      focusTarget?: TaskInspectorFocusTarget;
      range?: boolean;
    },
  ) => void;
  onToggleCollapsed: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  members: Member[];
  rowReorder: TaskRowReorderState | null;
  rowReorderGuide: { label: string; top: number; valid: boolean } | null;
  selectedTaskIds: Set<string>;
  tableRef: RefObject<HTMLDivElement | null>;
  tableSortKey: TaskTableSortKey | null;
  taskTitleEditRequest: { requestId: number; taskId: string | null };
  virtualWindow: {
    rows: TaskRow[];
    start: number;
    topSpacer: number;
    totalHeight: number;
  };
};

/** 仮想化されたタスク行と、範囲選択・並べ替えガイドを描画します。 */
export function TaskTableViewport({
  collapsedIds,
  columnVisibility,
  dependencyIssueByTaskId,
  displayMode,
  dragSelectionBox,
  members,
  onClickCapture,
  onContextMenu,
  onDragHandlePointerDown,
  onFocusTaskStart,
  onOpenTaskInspector,
  onPointerDown,
  onScroll,
  onSelectTask,
  onToggleCollapsed,
  onUpdateTask,
  rowReorder,
  rowReorderGuide,
  selectedTaskIds,
  tableRef,
  tableSortKey,
  taskTitleEditRequest,
  virtualWindow,
}: TaskTableViewportProps) {
  return (
    <div
      className={
        rowReorder
          ? "task-table reordering"
          : dragSelectionBox
            ? "task-table selecting"
            : "task-table"
      }
      data-tour="gantt-task-table"
      onClickCapture={onClickCapture}
      onPointerDown={onPointerDown}
      onScroll={onScroll}
      ref={tableRef}
    >
      <div
        className="task-table-spacer"
        style={{ height: virtualWindow.totalHeight } as CSSProperties}
      >
        {dragSelectionBox ? (
          <div
            aria-hidden="true"
            className="row-drag-selection"
            style={dragSelectionBox as CSSProperties}
          />
        ) : null}
        {rowReorderGuide ? (
          <div
            aria-hidden="true"
            className={rowReorderGuide.valid ? "row-reorder-guide" : "row-reorder-guide invalid"}
            style={{ top: rowReorderGuide.top } as CSSProperties}
          >
            <span>{rowReorderGuide.label}</span>
          </div>
        ) : null}
        <div
          className="task-table-window"
          style={{ top: virtualWindow.topSpacer } as CSSProperties}
        >
          {virtualWindow.rows.map((task) => (
            <TaskTableRow
              canReorder={displayMode !== "table" || tableSortKey === null}
              collapsed={collapsedIds.has(task.id)}
              columnVisibility={columnVisibility}
              dependencyIssues={dependencyIssueByTaskId.get(task.id) ?? []}
              dragReordering={Boolean(rowReorder?.draggingTaskIds.includes(task.id))}
              key={task.id}
              members={members}
              onContextMenu={(event) => onContextMenu(task.id, event)}
              onDragHandlePointerDown={(event) => onDragHandlePointerDown(task.id, event)}
              onFocusTaskStart={() => onFocusTaskStart(task.id)}
              onOpenInspector={() => onOpenTaskInspector(task.id)}
              onSelect={(options) => onSelectTask(task.id, options)}
              onToggle={() => onToggleCollapsed(task.id)}
              onUpdateTask={onUpdateTask}
              query=""
              selected={selectedTaskIds.has(task.id)}
              showDates={displayMode === "table"}
              task={task}
              titleEditSignal={
                taskTitleEditRequest.taskId === task.id ? taskTitleEditRequest.requestId : 0
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
