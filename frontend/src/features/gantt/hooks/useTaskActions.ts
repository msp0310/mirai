import type { Dispatch, SetStateAction } from "react";
import type {
  ActivityCategory,
  ActivityTone,
  CalendarDefinition,
  CreateMilestoneInput,
  CreateTaskInput,
  Member,
  ScheduleTask,
  TaskAssigneeAllocation,
  TaskStatus,
} from "../../../types/schedule";
import {
  addMilestone,
  addTask,
  deleteTaskSubtrees,
  duplicateTaskSubtrees,
  getTaskSubtrees,
  insertTaskAtTaskPosition,
  moveTaskByDays,
  moveTaskSubtreesByDays,
  moveTaskSubtreesToParent,
  moveTaskSubtreesToParentPosition,
  moveTaskSubtreesToSiblingPosition,
  moveTaskSubtreesWithinSiblings,
  normalizeSummaryTasks,
  outdentTask,
  pasteTaskSubtree,
  resizeTaskByDays,
  updateTaskById,
  type TaskInsertionResult,
  type TaskPasteMode,
  type TaskSiblingReorderPlacement,
} from "../../../lib/taskOperations";
import { statusLabels } from "../../../lib/schedule";
import type { TaskClipboard } from "../../../app/appTypes";

type CollapsedIdUpdate = Set<string> | ((current: Set<string>) => Set<string>);

type ActivityCallback = (input: {
  category: ActivityCategory;
  detail: string;
  taskId?: string;
  title: string;
  tone?: ActivityTone;
}) => void;

type ToastCallback = (input: {
  detail?: string;
  title: string;
  tone?: "info" | "success" | "warning";
}) => void;

type UseTaskActionsOptions = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  clearTaskSelection: () => void;
  commitTasks: (updater: (current: ScheduleTask[]) => ScheduleTask[]) => void;
  onActivity: ActivityCallback;
  onToast: ToastCallback;
  projectMembers: Member[];
  projectRangeStart: string;
  scheduleMembers: Member[];
  selectedTaskId: string | null;
  selectedTaskIds: Set<string>;
  selectAndFocusTaskTitle: (taskId: string) => void;
  selectOnlyTask: (taskId: string) => void;
  setCollapsedIds: (update: CollapsedIdUpdate) => void;
  setShowCreateSheet: Dispatch<SetStateAction<boolean>>;
  setTaskClipboard: Dispatch<SetStateAction<TaskClipboard | null>>;
  taskClipboard: TaskClipboard | null;
  taskClipboardRef: { current: TaskClipboard | null };
  taskPasteMode: TaskPasteMode;
  tasks: ScheduleTask[];
  visibleRows: Array<Pick<ScheduleTask, "id" | "title" | "type">>;
};

/**
 * Ganttのタスク変更操作をまとめます。
 * 画面本体から日程計算・階層移動・一括操作を分離し、操作の追加やテストを容易にします。
 */
export function useTaskActions({
  calendar,
  calendarAware,
  clearTaskSelection,
  commitTasks,
  onActivity,
  onToast,
  projectMembers,
  projectRangeStart,
  scheduleMembers,
  selectedTaskId,
  selectedTaskIds,
  selectAndFocusTaskTitle,
  selectOnlyTask,
  setCollapsedIds,
  setShowCreateSheet,
  setTaskClipboard,
  taskClipboard,
  taskClipboardRef,
  taskPasteMode,
  tasks,
  visibleRows,
}: UseTaskActionsOptions) {
  /** getSelectedTaskIdListを実行します。 */
  function getSelectedTaskIdList(taskIdOverride?: string | null) {
    if (taskIdOverride) return [taskIdOverride];
    const ids =
      selectedTaskIds.size > 0 ? selectedTaskIds : new Set(selectedTaskId ? [selectedTaskId] : []);
    return tasks.filter((task) => ids.has(task.id)).map((task) => task.id);
  }

  /** commitTaskInsertionを実行します。 */
  function commitTaskInsertion(createNext: (current: ScheduleTask[]) => TaskInsertionResult) {
    const result = createNext(tasks);
    if (result.tasks === tasks) return;
    commitTasks(() => result.tasks);
    if (result.insertedTaskId) selectAndFocusTaskTitle(result.insertedTaskId);
  }

  /** getEditableSelectedTasksを実行します。 */
  function getEditableSelectedTasks(taskIdOverride?: string | null) {
    const selectedIds = new Set(getSelectedTaskIdList(taskIdOverride));
    return tasks.filter(
      (task) => selectedIds.has(task.id) && task.type !== "summary" && task.type !== "phase",
    );
  }

  /** updateTaskを実行します。 */
  function updateTask(taskId: string, patch: Partial<ScheduleTask>) {
    commitTasks((current) => updateTaskById(current, taskId, patch, calendar, calendarAware));
  }

  /** setTaskDatesを実行します。 */
  function setTaskDates(taskId: string, patch: Partial<Pick<ScheduleTask, "end" | "start">>) {
    commitTasks((current) =>
      normalizeSummaryTasks(
        current.map((task) => {
          if (task.id !== taskId) return task;
          const start = patch.start ?? task.start;
          const end = task.type === "milestone" ? start : (patch.end ?? task.end);
          return { ...task, end: end < start ? start : end, start };
        }),
      ),
    );
  }

  /** bulkUpdateSelectedStatusを実行します。 */
  function bulkUpdateSelectedStatus(status: TaskStatus, taskIdOverride?: string | null) {
    const editableTasks = getEditableSelectedTasks(taskIdOverride);
    if (editableTasks.length === 0) {
      onToast({ title: "変更できる行がありません", tone: "warning" });
      return;
    }
    commitTasks((current) =>
      editableTasks.reduce(
        (nextTasks, task) =>
          updateTaskById(nextTasks, task.id, { status }, calendar, calendarAware),
        current,
      ),
    );
    onToast({
      detail: `${editableTasks.length}行を${statusLabels[status]}に変更`,
      title: "状態を一括変更しました",
    });
    onActivity({
      category: "task",
      detail: `${editableTasks.length}行を${statusLabels[status]}に変更しました。`,
      taskId: editableTasks[0]?.id,
      title: "状態を一括変更しました",
      tone: "success",
    });
  }

  /** bulkUpdateSelectedAssigneeを実行します。 */
  function bulkUpdateSelectedAssignee(memberId: string, taskIdOverride?: string | null) {
    const editableTasks = getEditableSelectedTasks(taskIdOverride);
    const member = projectMembers.find((item) => item.id === memberId);
    if (editableTasks.length === 0) {
      onToast({ title: "変更できる行がありません", tone: "warning" });
      return;
    }
    commitTasks((current) =>
      editableTasks.reduce(
        (nextTasks, task) =>
          updateTaskById(
            nextTasks,
            task.id,
            { assigneeAllocations: undefined, assigneeIds: [memberId] },
            calendar,
            calendarAware,
          ),
        current,
      ),
    );
    onToast({
      detail: `${editableTasks.length}行を${member?.name ?? memberId}に変更`,
      title: "担当者を一括変更しました",
    });
    onActivity({
      category: "task",
      detail: `${editableTasks.length}行の主担当を${member?.name ?? memberId}に変更しました。`,
      taskId: editableTasks[0]?.id,
      title: "担当者を一括変更しました",
      tone: "success",
    });
  }

  /** shareTaskWithMemberを実行します。 */
  function shareTaskWithMember(taskId: string, memberId: string) {
    const task = tasks.find((item) => item.id === taskId);
    const member = projectMembers.find((item) => item.id === memberId);
    if (!task || task.type === "summary" || task.type === "phase") {
      onToast({ title: "分担できるタスクが見つかりません", tone: "warning" });
      return;
    }
    if (task.assigneeIds.includes(memberId)) {
      onToast({
        detail: `${member?.name ?? memberId} は既に担当に含まれています`,
        title: "配分を確認してください",
        tone: "info",
      });
      return;
    }
    const assigneeIds = [...new Set([...task.assigneeIds, memberId])];
    commitTasks((current) =>
      updateTaskById(
        current,
        taskId,
        { assigneeAllocations: buildEvenAssigneeAllocations(assigneeIds), assigneeIds },
        calendar,
        calendarAware,
      ),
    );
    onToast({
      detail: `${member?.name ?? memberId} を分担に追加`,
      title: "担当を分担しました",
      tone: "success",
    });
    onActivity({
      category: "task",
      detail: `${member?.name ?? memberId} を分担者として追加しました。`,
      taskId,
      title: `担当を分担: ${task.title}`,
      tone: "success",
    });
  }

  /** createTaskを実行します。 */
  function createTask(input: CreateTaskInput) {
    commitTasks((current) => {
      const next = addTask(current, input, calendar, calendarAware);
      const created = next.at(-1);
      if (created) selectOnlyTask(created.id);
      return next;
    });
    setShowCreateSheet(false);
    onToast({ detail: input.title, title: "タスクを追加しました" });
    onActivity({
      category: "task",
      detail: `${input.start} - ${input.end}`,
      title: `タスクを追加: ${input.title}`,
      tone: "success",
    });
  }

  /** buildQuickTaskInputを実行します。 */
  function buildQuickTaskInput(anchorTask: ScheduleTask | undefined): CreateTaskInput {
    const fallbackAssigneeId = projectMembers[0]?.id ?? scheduleMembers[0]?.id ?? "yk";
    const start = anchorTask?.start ?? projectRangeStart;
    const parentId =
      anchorTask == null
        ? (tasks.find((task) => task.parentId === null)?.id ?? null)
        : anchorTask.type === "summary" || anchorTask.type === "phase"
          ? anchorTask.id
          : anchorTask.parentId;
    return {
      assigneeIds:
        anchorTask && anchorTask.assigneeIds.length > 0
          ? anchorTask.assigneeIds
          : [fallbackAssigneeId],
      effortHours: anchorTask?.type === "task" ? (anchorTask.effortHours ?? 8) : 8,
      end: anchorTask?.type === "task" || anchorTask?.type === "milestone" ? anchorTask.end : start,
      parentId,
      start,
      title: "新しい作業項目",
    };
  }

  /** insertTaskNearSelectionを実行します。 */
  function insertTaskNearSelection(
    placement: "before" | "after",
    anchorTaskIdOverride?: string | null,
  ) {
    commitTaskInsertion((current) => {
      const anchorTaskId =
        anchorTaskIdOverride ??
        selectedTaskId ??
        current.find((task) => task.parentId === null)?.id ??
        null;
      const anchorTask = anchorTaskId
        ? current.find((task) => task.id === anchorTaskId)
        : undefined;
      return insertTaskAtTaskPosition(
        current,
        anchorTaskId,
        buildQuickTaskInput(anchorTask),
        placement,
        calendar,
        calendarAware,
      );
    });
    onToast({ title: placement === "before" ? "上に行を挿入しました" : "下に行を挿入しました" });
    onActivity({
      category: "task",
      detail: `選択行の${placement === "before" ? "上" : "下"}に新しい作業項目を挿入しました。`,
      title: "行を挿入しました",
      tone: "success",
    });
  }

  /** copySelectedTaskを実行します。 */
  function copySelectedTask(taskIdOverride?: string | null) {
    const taskIds = getSelectedTaskIdList(taskIdOverride);
    if (taskIds.length === 0) return;
    const copiedTasks = getTaskSubtrees(tasks, taskIds);
    const rootTask = copiedTasks[0];
    if (!rootTask || rootTask.parentId === null) return;
    const nextClipboard = { copiedAt: Date.now(), label: rootTask.title, tasks: copiedTasks };
    taskClipboardRef.current = nextClipboard;
    setTaskClipboard(nextClipboard);
    onToast({
      detail: copiedTasks.length > 1 ? `${copiedTasks.length}行をコピー` : rootTask.title,
      title: "コピーしました",
      tone: "info",
    });
  }

  /** pasteCopiedTaskを実行します。 */
  function pasteCopiedTask(targetTaskIdOverride?: string | null) {
    const clipboard = taskClipboardRef.current ?? taskClipboard;
    if (!clipboard) {
      onToast({ title: "貼り付けるタスクがありません", tone: "warning" });
      return;
    }
    commitTaskInsertion((current) =>
      pasteTaskSubtree(
        current,
        clipboard.tasks,
        targetTaskIdOverride ??
          selectedTaskId ??
          current.find((task) => task.parentId === null)?.id ??
          null,
        taskPasteMode,
      ),
    );
    onToast({ detail: clipboard.label, title: "貼り付けました" });
    onActivity({
      category: "task",
      detail: `${clipboard.label} を${taskPasteMode === "child" ? "子階層" : "同階層"}として貼り付けました。`,
      title: "タスクを貼り付けました",
      tone: "success",
    });
  }

  /** duplicateSelectedTaskを実行します。 */
  function duplicateSelectedTask(taskIdOverride?: string | null) {
    const taskIds = getSelectedTaskIdList(taskIdOverride);
    if (taskIds.length === 0) return;
    commitTaskInsertion((current) =>
      duplicateTaskSubtrees(current, taskIds, taskIds.at(-1) ?? null),
    );
    onToast({ detail: `${taskIds.length}行`, title: "複製しました" });
    onActivity({
      category: "task",
      detail: `${taskIds.length}行を複製しました。`,
      taskId: taskIds[0],
      title: "タスクを複製しました",
      tone: "success",
    });
  }

  /** deleteSelectedTasksを実行します。 */
  function deleteSelectedTasks(taskIdOverride?: string | null) {
    const taskIds = getSelectedTaskIdList(taskIdOverride);
    if (taskIds.length === 0) return;
    commitTasks((current) => deleteTaskSubtrees(current, taskIds));
    clearTaskSelection();
    onToast({ detail: `${taskIds.length}行`, title: "削除しました", tone: "warning" });
    onActivity({
      category: "task",
      detail: `${taskIds.length}行を削除しました。`,
      title: "タスクを削除しました",
      tone: "warning",
    });
  }

  /** createMilestoneを実行します。 */
  function createMilestone(input: CreateMilestoneInput) {
    commitTasks((current) => addMilestone(current, input));
    onToast({ detail: input.title, title: "マイルストーンを追加しました" });
    onActivity({
      category: "task",
      detail: `${input.date} / ${input.assigneeIds.length}名`,
      title: `マイルストーンを追加: ${input.title}`,
      tone: "success",
    });
  }

  /** moveTaskを実行します。 */
  function moveTask(taskId: string, deltaDays: number) {
    const task = tasks.find((item) => item.id === taskId);
    commitTasks((current) => moveTaskByDays(current, taskId, deltaDays, calendar, calendarAware));
    if (task && deltaDays !== 0) {
      onActivity({
        category: "task",
        detail: `${Math.abs(deltaDays)}日${deltaDays > 0 ? "後ろ" : "前"}へ移動`,
        taskId,
        title: `日程を移動: ${task.title}`,
        tone: "info",
      });
    }
  }

  /** shiftSelectedTasksByDaysを実行します。 */
  function shiftSelectedTasksByDays(deltaDays: number, taskIdOverride?: string | null) {
    const selectedIds = getSelectedTaskIdList(taskIdOverride);
    const selectedSet = new Set(selectedIds);
    const movableTasks = tasks.filter(
      (task) => selectedSet.has(task.id) && task.type !== "summary",
    );
    if (movableTasks.length === 0) {
      onToast({ title: "移動できる行がありません", tone: "warning" });
      return;
    }
    commitTasks((current) =>
      moveTaskSubtreesByDays(current, selectedIds, deltaDays, calendar, calendarAware),
    );
    const direction = deltaDays > 0 ? "後ろ" : "前";
    onToast({
      detail: `${movableTasks.length}行を${Math.abs(deltaDays)}日${direction}へ移動`,
      title: "日付を一括移動しました",
      tone: "info",
    });
    onActivity({
      category: "task",
      detail: `${movableTasks.length}行を${Math.abs(deltaDays)}日${direction}へ移動しました。`,
      taskId: movableTasks[0]?.id,
      title: "日付を一括移動しました",
      tone: "info",
    });
  }

  /** resizeTaskを実行します。 */
  function resizeTask(taskId: string, edge: "start" | "end", deltaDays: number) {
    const task = tasks.find((item) => item.id === taskId);
    commitTasks((current) =>
      resizeTaskByDays(current, taskId, edge, deltaDays, calendar, calendarAware),
    );
    if (task && deltaDays !== 0) {
      onActivity({
        category: "task",
        detail: `${edge === "start" ? "開始日" : "終了日"}を${Math.abs(deltaDays)}日${deltaDays > 0 ? "後ろ" : "前"}へ調整しました。`,
        taskId,
        title: `期間を変更: ${task.title}`,
        tone: "info",
      });
    }
  }

  /** getSelectedMovableRootIdsを実行します。 */
  function getSelectedMovableRootIds(taskIds: string[]) {
    const selectedIds = new Set(taskIds);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return tasks
      .filter((task) => selectedIds.has(task.id) && task.parentId !== null)
      .filter((task) => {
        let parentId = task.parentId;
        while (parentId) {
          if (selectedIds.has(parentId)) return false;
          parentId = taskById.get(parentId)?.parentId ?? null;
        }
        return true;
      })
      .map((task) => task.id);
  }

  /** indentSelectedTasksを実行します。 */
  function indentSelectedTasks() {
    const taskIds = getSelectedTaskIdList();
    if (taskIds.length === 0) return;
    const selectedIds = new Set(taskIds);
    const firstSelectedIndex = visibleRows.findIndex((row) => selectedIds.has(row.id));
    let targetParent: Pick<ScheduleTask, "id" | "title" | "type"> | undefined;
    for (let index = firstSelectedIndex - 1; index >= 0; index -= 1) {
      const row = visibleRows[index];
      if (!selectedIds.has(row.id) && row.type !== "milestone") {
        targetParent = row;
        break;
      }
    }
    const movableRootIds = getSelectedMovableRootIds(taskIds);
    if (!targetParent || movableRootIds.length === 0) {
      onToast({ title: "階層を下げられる行がありません", tone: "warning" });
      return;
    }
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(targetParent!.id);
      return next;
    });
    commitTasks((current) => moveTaskSubtreesToParent(current, movableRootIds, targetParent!.id));
    onToast({ detail: `${movableRootIds.length}行`, title: "階層を下げました", tone: "info" });
    onActivity({
      category: "task",
      detail: `${targetParent.title} の子階層に${movableRootIds.length}行を移動しました。`,
      taskId: movableRootIds[0],
      title: "階層を下げました",
      tone: "info",
    });
  }

  /** outdentSelectedTasksを実行します。 */
  function outdentSelectedTasks() {
    const movableRootIds = getSelectedMovableRootIds(getSelectedTaskIdList());
    if (movableRootIds.length === 0) {
      onToast({ title: "階層を上げられる行がありません", tone: "warning" });
      return;
    }
    commitTasks((current) =>
      movableRootIds.reduce((next, taskId) => outdentTask(next, taskId), current),
    );
    onToast({ detail: `${movableRootIds.length}行`, title: "階層を上げました", tone: "info" });
    onActivity({
      category: "task",
      detail: `${movableRootIds.length}行を親階層へ移動しました。`,
      taskId: movableRootIds[0],
      title: "階層を上げました",
      tone: "info",
    });
  }

  /** scrollTaskを実行します。 */
  function scrollTask(taskId: string) {
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-task-id="${taskId}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  /** moveSelectedTaskWithinSiblingsを実行します。 */
  function moveSelectedTaskWithinSiblings(direction: -1 | 1, taskIdOverride?: string | null) {
    const taskIds = getSelectedTaskIdList(taskIdOverride);
    if (taskIds.length === 0) return;
    if (moveTaskSubtreesWithinSiblings(tasks, taskIds, direction) === tasks) {
      onToast({
        title: direction > 0 ? "これ以上下へ移動できません" : "これ以上上へ移動できません",
        tone: "warning",
      });
      return;
    }
    const focusTaskId = taskIdOverride ?? selectedTaskId ?? taskIds[0];
    const focusTask = tasks.find((item) => item.id === focusTaskId);
    commitTasks((current) => moveTaskSubtreesWithinSiblings(current, taskIds, direction));
    scrollTask(focusTaskId);
    onToast({
      detail: taskIds.length > 1 ? `${taskIds.length}行` : (focusTask?.title ?? "選択行"),
      title: direction > 0 ? "下へ移動しました" : "上へ移動しました",
      tone: "info",
    });
    onActivity({
      category: "task",
      detail: `${taskIds.length}行を同階層内で${direction > 0 ? "下" : "上"}へ移動しました。`,
      taskId: focusTask?.id ?? taskIds[0],
      title: "並び順を変更しました",
      tone: "info",
    });
  }

  /** moveSelectedTasksToSiblingPositionを実行します。 */
  function moveSelectedTasksToSiblingPosition(
    targetTaskId: string,
    placement: TaskSiblingReorderPlacement,
    taskIdsOverride?: string[],
  ) {
    const taskIds = taskIdsOverride?.length ? taskIdsOverride : getSelectedTaskIdList();
    if (taskIds.length === 0) return;
    const targetTask = tasks.find((task) => task.id === targetTaskId);
    if (moveTaskSubtreesToSiblingPosition(tasks, taskIds, targetTaskId, placement) === tasks) {
      onToast({ title: "同じ階層内で移動できません", tone: "warning" });
      return;
    }
    const focusTaskId =
      selectedTaskId && taskIds.includes(selectedTaskId) ? selectedTaskId : taskIds[0];
    commitTasks((current) =>
      moveTaskSubtreesToSiblingPosition(current, taskIds, targetTaskId, placement),
    );
    scrollTask(focusTaskId);
    onToast({
      detail:
        taskIds.length > 1
          ? `${taskIds.length}行`
          : (tasks.find((task) => task.id === focusTaskId)?.title ?? "選択行"),
      title: "行順を変更しました",
      tone: "info",
    });
    onActivity({
      category: "task",
      detail: `${taskIds.length}行を${targetTask?.title ?? "対象行"}の${placement === "before" ? "前" : "後"}へ移動しました。`,
      taskId: focusTaskId,
      title: "行順を変更しました",
      tone: "info",
    });
  }

  /** moveSelectedTasksToParentPositionを実行します。 */
  function moveSelectedTasksToParentPosition(
    targetParentId: string | null,
    taskIdsOverride: string[],
    referenceTaskId: string | null = null,
    placement: TaskSiblingReorderPlacement = "after",
  ) {
    const taskIds = taskIdsOverride.length ? taskIdsOverride : getSelectedTaskIdList();
    if (taskIds.length === 0) return;
    if (
      moveTaskSubtreesToParentPosition(
        tasks,
        taskIds,
        targetParentId,
        referenceTaskId,
        placement,
      ) === tasks
    ) {
      onToast({ title: "階層を移動できません", tone: "warning" });
      return;
    }
    if (targetParentId) {
      setCollapsedIds((current) => {
        const next = new Set(current);
        next.delete(targetParentId);
        return next;
      });
    }
    const focusTaskId =
      selectedTaskId && taskIds.includes(selectedTaskId) ? selectedTaskId : taskIds[0];
    const targetTask = targetParentId ? tasks.find((task) => task.id === targetParentId) : null;
    const referenceTask = referenceTaskId
      ? tasks.find((task) => task.id === referenceTaskId)
      : null;
    commitTasks((current) =>
      moveTaskSubtreesToParentPosition(
        current,
        taskIds,
        targetParentId,
        referenceTaskId,
        placement,
      ),
    );
    scrollTask(focusTaskId);
    const destination =
      targetTask?.title ?? referenceTask?.title ?? (targetParentId ? "指定した階層" : "最上位");
    onToast({ detail: destination, title: "階層を移動しました", tone: "info" });
    onActivity({
      category: "task",
      detail: `${taskIds.length}行を${destination}へ移動しました。`,
      taskId: focusTaskId,
      title: "階層を移動しました",
      tone: "info",
    });
  }

  return {
    bulkUpdateSelectedAssignee,
    bulkUpdateSelectedStatus,
    createMilestone,
    createTask,
    deleteSelectedTasks,
    duplicateSelectedTask,
    getSelectedTaskIdList,
    indentSelectedTasks,
    insertTaskAbove: (taskId?: string | null) => insertTaskNearSelection("before", taskId),
    insertTaskBelow: (taskId?: string | null) => insertTaskNearSelection("after", taskId),
    moveSelectedTaskWithinSiblings,
    moveSelectedTasksToParentPosition,
    moveSelectedTasksToSiblingPosition,
    moveTask,
    outdentSelectedTasks,
    pasteCopiedTask,
    copySelectedTask,
    resizeTask,
    setTaskDates,
    shareTaskWithMember,
    shiftSelectedTasksByDays,
    updateTask,
  };
}

/** 担当者をできるだけ均等な割合で割り当てます。 */
/** buildEvenAssigneeAllocationsを実行します。 */
function buildEvenAssigneeAllocations(assigneeIds: string[]) {
  const ids = [...new Set(assigneeIds)];
  if (ids.length === 0) return undefined;
  const base = Math.floor(100 / ids.length);
  const remainder = 100 - base * ids.length;
  return ids.map(
    (memberId, index): TaskAssigneeAllocation => ({
      memberId,
      percent: base + (index < remainder ? 1 : 0),
    }),
  );
}
