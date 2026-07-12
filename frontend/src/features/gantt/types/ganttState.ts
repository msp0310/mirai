import type { ScheduleTask, TaskInspectorFocusTarget } from "../../../types/schedule";

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
