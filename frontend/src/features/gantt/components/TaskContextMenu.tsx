import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { CSSProperties, RefObject } from "react";

import { getActiveMembers } from "../../../lib/members";
import { statusLabels } from "../../../lib/schedule";
import type { Member, ScheduleTask, TaskStatus } from "../../../types/schedule";
import type { TaskContextMenuState } from "../hooks/useTaskContextMenu";

type TaskContextMenuProps = {
  canPasteTask: boolean;
  menu: TaskContextMenuState;
  menuRef: RefObject<HTMLDivElement | null>;
  members: Member[];
  onAssigneeChange: (memberId: string, taskId?: string | null) => void;
  onClose: () => void;
  onCopy: (taskId?: string | null) => void;
  onDateShift: (deltaDays: number, taskId?: string | null) => void;
  onDelete: (taskId?: string | null) => void;
  onDuplicate: (taskId?: string | null) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onPaste: (taskId?: string | null) => void;
  onReorder: (direction: -1 | 1, taskId?: string | null) => void;
  onStatusChange: (status: TaskStatus, taskId?: string | null) => void;
  selectedTaskIds: Set<string>;
  tasks: ScheduleTask[];
};

/** 選択行に対するコピー、担当変更、階層、日程操作をまとめて表示します。 */
export function TaskContextMenu({
  canPasteTask,
  menu,
  menuRef,
  members,
  onAssigneeChange,
  onClose,
  onCopy,
  onDateShift,
  onDelete,
  onDuplicate,
  onIndent,
  onOutdent,
  onPaste,
  onReorder,
  onStatusChange,
  selectedTaskIds,
  tasks,
}: TaskContextMenuProps) {
  const contextTask = tasks.find((task) => task.id === menu.taskId);
  if (!contextTask) {
    return null;
  }
  const contextTaskSelected = selectedTaskIds.has(contextTask.id);
  const actionTaskId = contextTaskSelected ? undefined : menu.taskId;
  const selectedTasks = contextTaskSelected
    ? tasks.filter((task) => selectedTaskIds.has(task.id))
    : [contextTask];
  const selectionCount = selectedTasks.length;
  const canEdit = selectedTasks.some((task) => task.parentId !== null);
  const canBulkEdit = selectedTasks.some(
    (task) => task.type !== "summary" && task.type !== "phase",
  );
  const canShift = selectedTasks.some((task) => task.type !== "summary");
  const canReorder = selectedTasks.length > 0;
  const assigneeOptions = getActiveMembers(members);

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <div
      aria-label="タスク操作メニュー"
      className="task-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      ref={menuRef}
      role="menu"
      style={{ left: menu.x, top: menu.y } as CSSProperties}
    >
      <div className="task-context-menu-heading">
        <strong>{contextTask.title}</strong>
        <span>{selectionCount}行を操作</span>
      </div>
      <button
        disabled={!canEdit}
        onClick={() => run(() => onCopy(actionTaskId))}
        role="menuitem"
        type="button"
      >
        <ClipboardDocumentIcon />
        コピー
      </button>
      <button
        disabled={!canPasteTask}
        onClick={() => run(() => onPaste(menu.taskId))}
        role="menuitem"
        type="button"
      >
        <ClipboardDocumentCheckIcon />
        貼り付け
      </button>
      <button
        disabled={!canEdit}
        onClick={() => run(() => onDuplicate(actionTaskId))}
        role="menuitem"
        type="button"
      >
        <DocumentDuplicateIcon />
        複製
      </button>
      <div className="task-context-menu-separator" />
      <label className="task-context-select">
        <span>状態</span>
        <select
          aria-label="選択行の状態を変更"
          disabled={!canBulkEdit}
          onChange={(event) => {
            if (event.target.value) {
              run(() => onStatusChange(event.target.value as TaskStatus, actionTaskId));
            }
          }}
          value=""
        >
          <option value="">変更なし</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="task-context-select">
        <span>担当</span>
        <select
          aria-label="選択行の担当者を変更"
          disabled={!canBulkEdit}
          onChange={(event) => {
            if (event.target.value) {
              run(() => onAssigneeChange(event.target.value, actionTaskId));
            }
          }}
          value=""
        >
          <option value="">変更なし</option>
          {(assigneeOptions.length > 0 ? assigneeOptions : members).map((member) => (
            <option key={member.id} value={member.id}>
              {member.initials} {member.name}
            </option>
          ))}
        </select>
      </label>
      <div className="task-context-menu-separator" />
      <button disabled={!canEdit} onClick={() => run(onOutdent)} role="menuitem" type="button">
        <ArrowLeftIcon />
        階層を上げる
      </button>
      <button disabled={!canEdit} onClick={() => run(onIndent)} role="menuitem" type="button">
        <ArrowRightIcon />
        階層を下げる
      </button>
      <div className="task-context-menu-separator" />
      <button
        disabled={!canReorder}
        onClick={() => run(() => onReorder(-1, actionTaskId))}
        role="menuitem"
        type="button"
      >
        <ArrowUpIcon />
        上へ移動
      </button>
      <button
        disabled={!canReorder}
        onClick={() => run(() => onReorder(1, actionTaskId))}
        role="menuitem"
        type="button"
      >
        <ArrowDownIcon />
        下へ移動
      </button>
      <div className="task-context-menu-separator" />
      <button
        disabled={!canShift}
        onClick={() => run(() => onDateShift(-1, actionTaskId))}
        role="menuitem"
        type="button"
      >
        <ArrowLeftIcon />
        1日前へ移動
      </button>
      <button
        disabled={!canShift}
        onClick={() => run(() => onDateShift(1, actionTaskId))}
        role="menuitem"
        type="button"
      >
        <ArrowRightIcon />
        1日後へ移動
      </button>
      <div className="task-context-menu-separator" />
      <button
        className="danger"
        disabled={!canEdit}
        onClick={() => run(() => onDelete(actionTaskId))}
        role="menuitem"
        type="button"
      >
        <TrashIcon />
        削除
      </button>
    </div>
  );
}
