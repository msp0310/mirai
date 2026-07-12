import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { statusLabels } from "../../../lib/schedule";
import type { Member, TaskStatus } from "../../../types/schedule";

type GanttSelectionActionsProps = {
  assigneeOptions: Member[];
  canUseTaskActions: boolean;
  onBulkAssigneeChange: (memberId: string, taskId?: string | null) => void;
  onBulkDateShift: (deltaDays: number, taskId?: string | null) => void;
  onBulkStatusChange: (status: TaskStatus, taskId?: string | null) => void;
  onClearSelection: () => void;
  onCreateTask: () => void;
  onDeleteTask: () => void;
  selectedTaskCount: number;
};

/** タスク追加と選択行に対する一括操作を表示します。 */
export function GanttSelectionActions({
  assigneeOptions,
  canUseTaskActions,
  onBulkAssigneeChange,
  onBulkDateShift,
  onBulkStatusChange,
  onClearSelection,
  onCreateTask,
  onDeleteTask,
  selectedTaskCount,
}: GanttSelectionActionsProps) {
  return (
    <>
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
              if (event.target.value) {
                onBulkStatusChange(event.target.value as TaskStatus);
              }
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
              if (event.target.value) {
                onBulkAssigneeChange(event.target.value);
              }
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
        <>
          <button
            className="subtle-action"
            onClick={onClearSelection}
            title="選択を解除 (Esc)"
            type="button"
          >
            <XMarkIcon />
            選択解除
          </button>
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
        </>
      ) : null}
    </>
  );
}
