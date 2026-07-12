import type { TaskSiblingReorderPlacement } from "../../../lib/taskOperations";
import type { ScheduleTask, TaskInspectorFocusTarget } from "../../../types/schedule";

export type TaskTableSortKey = "assignee" | "end" | "progress" | "start" | "status" | "title";

export type TaskTableSortState = {
  direction: "asc" | "desc";
  key: TaskTableSortKey | null;
};

export type TaskRowReorderMode = "child" | "outdent" | "sibling";

export type TaskRowReorderState = {
  draggingTaskIds: string[];
  mode: TaskRowReorderMode;
  placement: TaskSiblingReorderPlacement;
  referenceTaskId: string | null;
  reason: string;
  sourceTaskId: string;
  targetParentId: string | null;
  targetTaskId: string | null;
  valid: boolean;
};

export type VisibleTimelineSlotWindow = {
  end: number;
  start: number;
};

/** 1プロジェクト分のタスクに対するUndo/Redo状態です。 */
export type TaskHistory = {
  future: ScheduleTask[][];
  past: ScheduleTask[][];
  present: ScheduleTask[];
};

/** タスクのコピー・貼り付け操作で使うクリップボード情報です。 */
export type TaskClipboard = {
  copiedAt: number;
  label: string;
  tasks: ScheduleTask[];
};

/** マウス操作とキーボード操作で共有する選択オプションです。 */
export type TaskSelectionOptions = {
  additive?: boolean;
  focusTarget?: TaskInspectorFocusTarget;
  range?: boolean;
};

/** フォーカス対象のタスクと詳細画面のセクションを識別します。 */
export type TaskFocusRequest = {
  requestId: number;
  target: TaskInspectorFocusTarget;
  taskId: string;
};
