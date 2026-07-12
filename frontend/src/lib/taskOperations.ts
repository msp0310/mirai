import type {
  CalendarDefinition,
  CreateMilestoneInput,
  CreateTaskInput,
  ScheduleTask,
  TaskDateChange,
  TaskStatus,
} from "../types/schedule";
import {
  addDays,
  daysInclusive,
  extendEndForWorkingDays,
  getWorkingDaySpan,
  parseDate,
  toDateKey,
} from "./schedule";

const palette = ["#89b7ff", "#9addb8", "#ffc184", "#c7d2fe", "#8bd4d2"];

export type TaskInsertionResult = {
  insertedTaskId: string | null;
  tasks: ScheduleTask[];
};

export type TaskDateRange = Pick<ScheduleTask, "end" | "start">;

export type TaskPasteMode = "child" | "sibling";
export type TaskSiblingReorderPlacement = "before" | "after";

/** createTaskFromInputを実行し、アプリケーション用の値を返します。 */
export function createTaskFromInput(
  input: CreateTaskInput,
  existingTasks: ScheduleTask[],
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask {
  const id = `task-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`;
  const siblings = existingTasks.filter((task) => task.parentId === input.parentId);
  const requestedWorkDays = getRequestedWorkDays(input.start, input.end);
  const assigneeIds = input.assigneeIds.length > 0 ? input.assigneeIds : ["yk"];
  return {
    assigneeAllocations: createEqualAssigneeAllocations(assigneeIds),
    assigneeIds,
    color: palette[siblings.length % palette.length],
    dependencies: [],
    effortHours: input.effortHours,
    end: resolveEndForWorkDays(input.start, requestedWorkDays, calendar, calendarAware),
    id,
    parentId: input.parentId,
    progress: 0,
    start: input.start,
    status: "notStarted",
    title: input.title.trim() || "新しい作業項目",
    type: "task",
  };
}

function createEqualAssigneeAllocations(assigneeIds: string[]) {
  const ids = [...new Set(assigneeIds)];
  if (ids.length <= 1) return undefined;
  const base = Math.floor(100 / ids.length);
  const remainder = 100 - base * ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    percent: base + (index === ids.length - 1 ? remainder : 0),
  }));
}

/** updateTaskByIdを実行し、アプリケーション用の値を返します。 */
export function updateTaskById(
  tasks: ScheduleTask[],
  taskId: string,
  patch: Partial<ScheduleTask>,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask[] {
  return normalizeSummaryTasks(
    tasks.map((task) =>
      task.id === taskId ? applyTaskPatch(task, patch, calendar, calendarAware) : task,
    ),
  );
}

/** moveTaskByDaysを実行し、アプリケーション用の値を返します。 */
export function moveTaskByDays(
  tasks: ScheduleTask[],
  taskId: string,
  deltaDays: number,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask[] {
  if (deltaDays === 0) return tasks;
  const targetIds = getDescendantIds(tasks, taskId);
  targetIds.add(taskId);
  return moveTaskIdsByDays(tasks, targetIds, deltaDays, calendar, calendarAware);
}

/** moveTaskSubtreesByDaysを実行し、アプリケーション用の値を返します。 */
export function moveTaskSubtreesByDays(
  tasks: ScheduleTask[],
  taskIds: string[],
  deltaDays: number,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask[] {
  if (deltaDays === 0 || taskIds.length === 0) return tasks;
  const selectedIds = new Set(taskIds);
  const movableSelectedIds = new Set(
    tasks
      .filter((task) => selectedIds.has(task.id) && task.type !== "summary")
      .map((task) => task.id),
  );
  const rootIds = tasks
    .filter(
      (task) =>
        movableSelectedIds.has(task.id) && !hasSelectedAncestor(tasks, task.id, movableSelectedIds),
    )
    .map((task) => task.id);
  if (rootIds.length === 0) return tasks;

  const targetIds = new Set<string>();
  rootIds.forEach((taskId) => {
    targetIds.add(taskId);
    getDescendantIds(tasks, taskId).forEach((id) => targetIds.add(id));
  });
  return moveTaskIdsByDays(tasks, targetIds, deltaDays, calendar, calendarAware);
}

function moveTaskIdsByDays(
  tasks: ScheduleTask[],
  targetIds: Set<string>,
  deltaDays: number,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask[] {
  return normalizeSummaryTasks(
    tasks.map((task) => {
      if (!targetIds.has(task.id)) return task;
      return { ...task, ...getMovedTaskDateRange(task, deltaDays, calendar, calendarAware) };
    }),
  );
}

/** 稼働日数を維持したまま、指定した暦日数だけタスクを移動します。 */
export function getMovedTaskDateRange(
  task: ScheduleTask,
  deltaDays: number,
  calendar?: CalendarDefinition,
  calendarAware = true,
): TaskDateRange {
  const start = toDateKey(addDays(parseDate(task.start), deltaDays));
  if (task.type === "milestone") return { end: start, start };
  const workDays = getTaskWorkDays(task, calendar, calendarAware);
  return {
    end: resolveEndForWorkDays(start, workDays, calendar, calendarAware),
    start,
  };
}

/** ドラッグした端の日付をそのまま採用し、反対側の日付を維持します。 */
export function getResizedTaskDateRange(
  task: ScheduleTask,
  edge: "start" | "end",
  deltaDays: number,
): TaskDateRange {
  if (task.type === "milestone") {
    const date = toDateKey(addDays(parseDate(task.start), deltaDays));
    return { end: date, start: date };
  }
  if (edge === "start") {
    const start = toDateKey(addDays(parseDate(task.start), deltaDays));
    return { end: task.end, start: start > task.end ? task.end : start };
  }
  const end = toDateKey(addDays(parseDate(task.end), deltaDays));
  return { end: end < task.start ? task.start : end, start: task.start };
}

function getDescendantIds(tasks: ScheduleTask[], taskId: string): Set<string> {
  const ids = new Set<string>();
  const walk = (parentId: string) => {
    tasks
      .filter((task) => task.parentId === parentId)
      .forEach((task) => {
        ids.add(task.id);
        walk(task.id);
      });
  };
  walk(taskId);
  return ids;
}

/** resizeTaskByDaysを実行し、アプリケーション用の値を返します。 */
export function resizeTaskByDays(
  tasks: ScheduleTask[],
  taskId: string,
  edge: "start" | "end",
  deltaDays: number,
): ScheduleTask[] {
  if (deltaDays === 0) return tasks;
  return normalizeSummaryTasks(
    tasks.map((task) => {
      if (task.id !== taskId) return task;
      return { ...task, ...getResizedTaskDateRange(task, edge, deltaDays) };
    }),
  );
}

/** addTaskを実行し、アプリケーション用の値を返します。 */
export function addTask(
  tasks: ScheduleTask[],
  input: CreateTaskInput,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask[] {
  return normalizeSummaryTasks([
    ...tasks,
    createTaskFromInput(input, tasks, calendar, calendarAware),
  ]);
}

/** insertTaskAfterTaskを実行し、アプリケーション用の値を返します。 */
export function insertTaskAfterTask(
  tasks: ScheduleTask[],
  anchorTaskId: string | null,
  input: CreateTaskInput,
  calendar?: CalendarDefinition,
  calendarAware = true,
): TaskInsertionResult {
  const anchor = anchorTaskId ? tasks.find((task) => task.id === anchorTaskId) : null;
  const parentId = anchor ? getNewTaskParentId(anchor) : input.parentId;
  const insertIndex = anchor ? getSubtreeEndIndex(tasks, anchor.id) + 1 : tasks.length;
  const task = createTaskFromInput({ ...input, parentId }, tasks, calendar, calendarAware);
  return {
    insertedTaskId: task.id,
    tasks: normalizeSummaryTasks([
      ...tasks.slice(0, insertIndex),
      task,
      ...tasks.slice(insertIndex),
    ]),
  };
}

/** insertTaskAtTaskPositionを実行し、アプリケーション用の値を返します。 */
export function insertTaskAtTaskPosition(
  tasks: ScheduleTask[],
  anchorTaskId: string | null,
  input: CreateTaskInput,
  placement: TaskSiblingReorderPlacement,
  calendar?: CalendarDefinition,
  calendarAware = true,
): TaskInsertionResult {
  const anchor = anchorTaskId ? tasks.find((task) => task.id === anchorTaskId) : null;
  const parentId = anchor ? getTaskPositionParentId(anchor) : input.parentId;
  const anchorIndex = anchor ? tasks.findIndex((task) => task.id === anchor.id) : -1;
  const insertIndex =
    anchor && placement === "before" && parentId !== anchor.id
      ? Math.max(anchorIndex, 0)
      : anchor
        ? getSubtreeEndIndex(tasks, anchor.id) + 1
        : tasks.length;
  const task = createTaskFromInput({ ...input, parentId }, tasks, calendar, calendarAware);
  return {
    insertedTaskId: task.id,
    tasks: normalizeSummaryTasks([
      ...tasks.slice(0, insertIndex),
      task,
      ...tasks.slice(insertIndex),
    ]),
  };
}

/** getTaskSubtreeを実行し、アプリケーション用の値を返します。 */
export function getTaskSubtree(tasks: ScheduleTask[], taskId: string): ScheduleTask[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return [];
  const subtreeIds = getDescendantIds(tasks, taskId);
  subtreeIds.add(taskId);
  return tasks.filter((item) => subtreeIds.has(item.id));
}

/** getTaskSubtreesを実行し、アプリケーション用の値を返します。 */
export function getTaskSubtrees(tasks: ScheduleTask[], taskIds: string[]): ScheduleTask[] {
  const selectedIds = new Set(taskIds);
  const movableSelectedIds = new Set(
    tasks
      .filter((task) => selectedIds.has(task.id) && task.parentId !== null)
      .map((task) => task.id),
  );
  const rootIds = tasks
    .filter(
      (task) =>
        movableSelectedIds.has(task.id) && !hasSelectedAncestor(tasks, task.id, movableSelectedIds),
    )
    .map((task) => task.id);
  const subtreeIds = new Set<string>();
  rootIds.forEach((taskId) => {
    subtreeIds.add(taskId);
    getDescendantIds(tasks, taskId).forEach((id) => subtreeIds.add(id));
  });
  return tasks.filter((task) => subtreeIds.has(task.id));
}

/** duplicateTaskSubtreeを実行し、アプリケーション用の値を返します。 */
export function duplicateTaskSubtree(
  tasks: ScheduleTask[],
  sourceTaskId: string,
  targetTaskId = sourceTaskId,
): TaskInsertionResult {
  return duplicateTaskSubtrees(tasks, [sourceTaskId], targetTaskId);
}

/** duplicateTaskSubtreesを実行し、アプリケーション用の値を返します。 */
export function duplicateTaskSubtrees(
  tasks: ScheduleTask[],
  sourceTaskIds: string[],
  targetTaskId = sourceTaskIds.at(-1) ?? null,
): TaskInsertionResult {
  return pasteTaskSubtree(tasks, getTaskSubtrees(tasks, sourceTaskIds), targetTaskId, "sibling");
}

/** pasteTaskSubtreeを実行し、アプリケーション用の値を返します。 */
export function pasteTaskSubtree(
  tasks: ScheduleTask[],
  copiedTasks: ScheduleTask[],
  targetTaskId: string | null,
  mode: TaskPasteMode = "sibling",
): TaskInsertionResult {
  const copiedRootTasks = getCopiedRootTasks(copiedTasks);
  if (copiedRootTasks.length === 0) {
    return { insertedTaskId: null, tasks };
  }

  const target = targetTaskId ? tasks.find((task) => task.id === targetTaskId) : null;
  const fallbackParentId = tasks.find((task) => task.parentId === null)?.id ?? null;
  const firstSourceRoot = copiedRootTasks[0];
  const parentId = target
    ? getPastedTaskParentId(target, mode)
    : tasks.some((task) => task.id === firstSourceRoot.parentId)
      ? firstSourceRoot.parentId
      : fallbackParentId;
  const insertIndex = target ? getSubtreeEndIndex(tasks, target.id) + 1 : tasks.length;
  const pastedTasks = createPastedSubtree(copiedTasks, parentId);
  const pastedRoot = pastedTasks[0];
  if (!pastedRoot) return { insertedTaskId: null, tasks };

  return {
    insertedTaskId: pastedRoot.id,
    tasks: normalizeSummaryTasks([
      ...tasks.slice(0, insertIndex),
      ...pastedTasks,
      ...tasks.slice(insertIndex),
    ]),
  };
}

/** deleteTaskSubtreesを実行し、アプリケーション用の値を返します。 */
export function deleteTaskSubtrees(tasks: ScheduleTask[], taskIds: string[]): ScheduleTask[] {
  const deletedTasks = getTaskSubtrees(tasks, taskIds);
  if (deletedTasks.length === 0) return tasks;
  const deletedIds = new Set(deletedTasks.map((task) => task.id));
  return normalizeSummaryTasks(
    tasks
      .filter((task) => !deletedIds.has(task.id))
      .map((task) => ({
        ...task,
        dependencies: (task.dependencies ?? []).filter(
          (dependencyId) => !deletedIds.has(dependencyId),
        ),
      })),
  );
}

/** addMilestoneを実行し、アプリケーション用の値を返します。 */
export function addMilestone(tasks: ScheduleTask[], input: CreateMilestoneInput): ScheduleTask[] {
  const siblings = tasks.filter((task) => task.parentId === input.parentId);
  const insertIndex = getInsertIndexAfterSiblings(tasks, input.parentId, siblings);
  const milestone: ScheduleTask = {
    id: `milestone-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`,
    parentId: input.parentId,
    title: input.title.trim() || "新しいマイルストーン",
    type: "milestone",
    status: "notStarted",
    start: input.date,
    end: input.date,
    progress: 0,
    assigneeIds: input.assigneeIds.length > 0 ? input.assigneeIds : ["yk"],
    color: "#0f69c9",
    dependencies: [],
  };
  return normalizeSummaryTasks([
    ...tasks.slice(0, insertIndex),
    milestone,
    ...tasks.slice(insertIndex),
  ]);
}

function getSubtreeEndIndex(tasks: ScheduleTask[], taskId: string): number {
  const subtreeIds = getDescendantIds(tasks, taskId);
  subtreeIds.add(taskId);
  return tasks.reduce((endIndex, task, index) => (subtreeIds.has(task.id) ? index : endIndex), -1);
}

function hasSelectedAncestor(
  tasks: ScheduleTask[],
  taskId: string,
  selectedIds: Set<string>,
): boolean {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  let parentId = taskById.get(taskId)?.parentId;
  while (parentId) {
    if (selectedIds.has(parentId)) return true;
    parentId = taskById.get(parentId)?.parentId;
  }
  return false;
}

function getInsertIndexAfterSiblings(
  tasks: ScheduleTask[],
  parentId: string | null,
  siblings: ScheduleTask[],
): number {
  if (siblings.length === 0) {
    const parentIndex = tasks.findIndex((task) => task.id === parentId);
    return parentIndex >= 0 ? parentIndex + 1 : tasks.length;
  }
  const lastSibling = siblings[siblings.length - 1];
  const subtreeIds = getDescendantIds(tasks, lastSibling.id);
  subtreeIds.add(lastSibling.id);
  const subtreeEndIndex = tasks.reduce(
    (endIndex, task, index) => (subtreeIds.has(task.id) ? index : endIndex),
    -1,
  );
  return subtreeEndIndex >= 0 ? subtreeEndIndex + 1 : tasks.length;
}

function getNewTaskParentId(anchor: ScheduleTask): string | null {
  if (anchor.type === "summary" || anchor.type === "phase") return anchor.id;
  return anchor.parentId;
}

function getTaskPositionParentId(anchor: ScheduleTask): string | null {
  if (anchor.parentId === null && anchor.type === "summary") return anchor.id;
  return anchor.parentId;
}

function getPastedTaskParentId(anchor: ScheduleTask, mode: TaskPasteMode): string | null {
  if (mode === "child" && anchor.type !== "milestone") return anchor.id;
  if (anchor.parentId === null && anchor.type === "summary") return anchor.id;
  return anchor.parentId;
}

function getCopiedRootTasks(copiedTasks: ScheduleTask[]) {
  const copiedIds = new Set(copiedTasks.map((task) => task.id));
  return copiedTasks.filter((task) => task.parentId !== null && !copiedIds.has(task.parentId));
}

function createPastedSubtree(copiedTasks: ScheduleTask[], parentId: string | null): ScheduleTask[] {
  const copiedRootIds = new Set(getCopiedRootTasks(copiedTasks).map((task) => task.id));
  const stamp = Date.now().toString(36);
  const idMap = new Map(
    copiedTasks.map((task, index) => [
      task.id,
      `${task.type}-${stamp}-${index}-${Math.round(Math.random() * 999)}`,
    ]),
  );

  return copiedTasks.map((task, index) => {
    const id = idMap.get(task.id) ?? `${task.type}-${stamp}-${index}`;
    const dependencies = (task.dependencies ?? [])
      .filter((dependencyId) => idMap.has(dependencyId))
      .map((dependencyId) => idMap.get(dependencyId) ?? dependencyId);
    const nextParentId = copiedRootIds.has(task.id)
      ? parentId
      : (idMap.get(task.parentId ?? "") ?? parentId);

    return {
      ...task,
      dependencies,
      expanded: task.type === "task" || task.type === "milestone" ? task.expanded : true,
      id,
      parentId: nextParentId,
      progress: 0,
      status: "notStarted",
      title: copiedRootIds.has(task.id) ? `${task.title} コピー` : task.title,
    };
  });
}

/** indentTaskを実行し、アプリケーション用の値を返します。 */
export function indentTask(
  tasks: ScheduleTask[],
  taskId: string,
  parentId: string,
): ScheduleTask[] {
  const task = tasks.find((item) => item.id === taskId);
  const parent = tasks.find((item) => item.id === parentId);
  if (!task || !parent) return tasks;
  if (task.parentId === null || task.parentId === parentId) return tasks;
  if (parent.type === "milestone" || parent.id === task.id) return tasks;
  if (getDescendantIds(tasks, task.id).has(parent.id)) return tasks;

  return normalizeSummaryTasks(
    tasks.map((item) => (item.id === taskId ? { ...item, parentId: parent.id } : item)),
  );
}

/** outdentTaskを実行し、アプリケーション用の値を返します。 */
export function outdentTask(tasks: ScheduleTask[], taskId: string): ScheduleTask[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task?.parentId) return tasks;
  const parent = tasks.find((item) => item.id === task.parentId);
  if (!parent) return tasks;
  return normalizeSummaryTasks(
    tasks.map((item) => (item.id === taskId ? { ...item, parentId: parent.parentId } : item)),
  );
}

/** moveTaskWithinSiblingsを実行し、アプリケーション用の値を返します。 */
export function moveTaskWithinSiblings(
  tasks: ScheduleTask[],
  taskId: string,
  direction: -1 | 1,
): ScheduleTask[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return tasks;
  const siblings = tasks.filter((item) => item.parentId === task.parentId);
  const currentIndex = siblings.findIndex((item) => item.id === taskId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblings.length) {
    return tasks;
  }

  const nextSiblings = [...siblings];
  [nextSiblings[currentIndex], nextSiblings[nextIndex]] = [
    nextSiblings[nextIndex],
    nextSiblings[currentIndex],
  ];
  let siblingCursor = 0;
  return normalizeSummaryTasks(
    tasks.map((item) => (item.parentId === task.parentId ? nextSiblings[siblingCursor++] : item)),
  );
}

/** moveTaskSubtreesWithinSiblingsを実行し、アプリケーション用の値を返します。 */
export function moveTaskSubtreesWithinSiblings(
  tasks: ScheduleTask[],
  taskIds: string[],
  direction: -1 | 1,
): ScheduleTask[] {
  if (taskIds.length === 0) return tasks;

  const rootIds = getSelectedRootIds(tasks, taskIds);
  if (rootIds.length === 0) return tasks;

  const rootIdSet = new Set(rootIds);
  const reorderedSiblingsByParent = new Map<string | null, ScheduleTask[]>();
  let changed = false;

  rootIds.forEach((taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || reorderedSiblingsByParent.has(task.parentId)) return;

    const siblings = tasks.filter((item) => item.parentId === task.parentId);
    const siblingRootIds = new Set(
      siblings.filter((item) => rootIdSet.has(item.id)).map((item) => item.id),
    );
    const nextSiblings = [...siblings];

    if (direction < 0) {
      for (let index = 1; index < nextSiblings.length; index += 1) {
        const current = nextSiblings[index];
        const previous = nextSiblings[index - 1];
        if (siblingRootIds.has(current.id) && !siblingRootIds.has(previous.id)) {
          [nextSiblings[index - 1], nextSiblings[index]] = [current, previous];
          changed = true;
        }
      }
    } else {
      for (let index = nextSiblings.length - 2; index >= 0; index -= 1) {
        const current = nextSiblings[index];
        const next = nextSiblings[index + 1];
        if (siblingRootIds.has(current.id) && !siblingRootIds.has(next.id)) {
          [nextSiblings[index], nextSiblings[index + 1]] = [next, current];
          changed = true;
        }
      }
    }

    reorderedSiblingsByParent.set(task.parentId, nextSiblings);
  });

  if (!changed) return tasks;

  const siblingCursors = new Map<string | null, number>();
  return normalizeSummaryTasks(
    tasks.map((item) => {
      const nextSiblings = reorderedSiblingsByParent.get(item.parentId);
      if (!nextSiblings) return item;
      const cursor = siblingCursors.get(item.parentId) ?? 0;
      siblingCursors.set(item.parentId, cursor + 1);
      return nextSiblings[cursor] ?? item;
    }),
  );
}

/** moveTaskSubtreesToSiblingPositionを実行し、アプリケーション用の値を返します。 */
export function moveTaskSubtreesToSiblingPosition(
  tasks: ScheduleTask[],
  taskIds: string[],
  targetTaskId: string,
  placement: TaskSiblingReorderPlacement,
): ScheduleTask[] {
  const targetTask = tasks.find((task) => task.id === targetTaskId);
  if (!targetTask || taskIds.length === 0) return tasks;

  const rootIds = getSelectedRootIds(tasks, taskIds);
  if (rootIds.length === 0 || rootIds.includes(targetTaskId)) return tasks;

  const rootTasks = rootIds
    .map((taskId) => tasks.find((task) => task.id === taskId))
    .filter((task): task is ScheduleTask => Boolean(task));
  if (rootTasks.length === 0 || rootTasks.some((task) => task.parentId !== targetTask.parentId)) {
    return tasks;
  }

  const movingRootIds = new Set(rootTasks.map((task) => task.id));
  const siblings = tasks.filter((task) => task.parentId === targetTask.parentId);
  const movingSiblings = siblings.filter((task) => movingRootIds.has(task.id));
  const remainingSiblings = siblings.filter((task) => !movingRootIds.has(task.id));
  const targetIndex = remainingSiblings.findIndex((task) => task.id === targetTaskId);
  if (targetIndex < 0) return tasks;

  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  const nextSiblings = [
    ...remainingSiblings.slice(0, insertIndex),
    ...movingSiblings,
    ...remainingSiblings.slice(insertIndex),
  ];
  if (hasSameTaskOrder(siblings, nextSiblings)) return tasks;

  let siblingCursor = 0;
  return normalizeSummaryTasks(
    tasks.map((task) =>
      task.parentId === targetTask.parentId ? nextSiblings[siblingCursor++] : task,
    ),
  );
}

/** moveTaskSubtreesToParentを実行し、アプリケーション用の値を返します。 */
export function moveTaskSubtreesToParent(
  tasks: ScheduleTask[],
  taskIds: string[],
  targetParentId: string | null,
): ScheduleTask[] {
  return moveTaskSubtreesToParentPosition(tasks, taskIds, targetParentId);
}

/** moveTaskSubtreesToParentPositionを実行し、アプリケーション用の値を返します。 */
export function moveTaskSubtreesToParentPosition(
  tasks: ScheduleTask[],
  taskIds: string[],
  targetParentId: string | null,
  referenceTaskId: string | null = null,
  placement: TaskSiblingReorderPlacement = "after",
): ScheduleTask[] {
  const targetParent = targetParentId ? tasks.find((task) => task.id === targetParentId) : null;
  if (targetParentId && (!targetParent || targetParent.type === "milestone")) {
    return tasks;
  }

  const rootIds = getMovableSelectedRootIds(tasks, taskIds);
  if (rootIds.length === 0) return tasks;

  const movingSubtreeIds = new Set<string>();
  rootIds.forEach((taskId) => {
    movingSubtreeIds.add(taskId);
    getDescendantIds(tasks, taskId).forEach((id) => movingSubtreeIds.add(id));
  });
  if (targetParentId && movingSubtreeIds.has(targetParentId)) return tasks;

  const movingRootIds = new Set(rootIds);
  const updatedTasks = tasks.map((task) =>
    movingRootIds.has(task.id) ? { ...task, parentId: targetParentId } : task,
  );
  const movingRoots = updatedTasks.filter((task) => movingRootIds.has(task.id));
  const remainingTasks = updatedTasks.filter((task) => !movingRootIds.has(task.id));
  const insertIndex = referenceTaskId
    ? getReferenceInsertIndex(remainingTasks, referenceTaskId, placement)
    : getMoveTargetInsertIndex(remainingTasks, targetParentId);

  return normalizeSummaryTasks([
    ...remainingTasks.slice(0, insertIndex),
    ...movingRoots,
    ...remainingTasks.slice(insertIndex),
  ]);
}

function getMovableSelectedRootIds(tasks: ScheduleTask[], taskIds: string[]): string[] {
  const selectedIds = new Set(taskIds);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return tasks
    .filter(
      (task) =>
        selectedIds.has(task.id) &&
        task.parentId !== null &&
        !hasSelectedMovableAncestor(taskById, task.id, selectedIds),
    )
    .map((task) => task.id);
}

function getSelectedRootIds(tasks: ScheduleTask[], taskIds: string[]): string[] {
  const selectedIds = new Set(taskIds);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return tasks
    .filter(
      (task) =>
        selectedIds.has(task.id) && !hasSelectedAncestorFromMap(taskById, task.id, selectedIds),
    )
    .map((task) => task.id);
}

function hasSelectedMovableAncestor(
  taskById: Map<string, ScheduleTask>,
  taskId: string,
  selectedIds: Set<string>,
): boolean {
  let parentId = taskById.get(taskId)?.parentId;
  while (parentId) {
    const parent = taskById.get(parentId);
    if (selectedIds.has(parentId) && parent?.parentId !== null) return true;
    parentId = parent?.parentId;
  }
  return false;
}

function hasSelectedAncestorFromMap(
  taskById: Map<string, ScheduleTask>,
  taskId: string,
  selectedIds: Set<string>,
): boolean {
  let parentId = taskById.get(taskId)?.parentId;
  while (parentId) {
    if (selectedIds.has(parentId)) return true;
    parentId = taskById.get(parentId)?.parentId;
  }
  return false;
}

function hasSameTaskOrder(left: ScheduleTask[], right: ScheduleTask[]) {
  return left.length === right.length && left.every((task, index) => task.id === right[index]?.id);
}

function getMoveTargetInsertIndex(tasks: ScheduleTask[], targetParentId: string | null): number {
  let lastSiblingIndex = -1;
  tasks.forEach((task, index) => {
    if (task.parentId === targetParentId) {
      lastSiblingIndex = index;
    }
  });
  if (lastSiblingIndex >= 0) return lastSiblingIndex + 1;

  if (!targetParentId) return tasks.length;
  const parentIndex = tasks.findIndex((task) => task.id === targetParentId);
  return parentIndex >= 0 ? parentIndex + 1 : tasks.length;
}

function getReferenceInsertIndex(
  tasks: ScheduleTask[],
  referenceTaskId: string,
  placement: TaskSiblingReorderPlacement,
): number {
  const referenceIndex = tasks.findIndex((task) => task.id === referenceTaskId);
  if (referenceIndex < 0) return tasks.length;
  if (placement === "before") return referenceIndex;
  const subtreeEndIndex = getSubtreeEndIndex(tasks, referenceTaskId);
  return (subtreeEndIndex >= 0 ? subtreeEndIndex : referenceIndex) + 1;
}

/** normalizeTaskDatesを実行し、アプリケーション用の値を返します。 */
export function normalizeTaskDates(task: ScheduleTask): ScheduleTask {
  if (task.type === "milestone") {
    return { ...task, end: task.start };
  }
  if (task.end < task.start) {
    return { ...task, end: task.start };
  }
  return task;
}

/** normalizeDateChangeを実行し、アプリケーション用の値を返します。 */
export function normalizeDateChange(change: TaskDateChange): TaskDateChange {
  return change.end < change.start ? { ...change, end: change.start } : change;
}

/** normalizeProgressStatusを実行し、アプリケーション用の値を返します。 */
export function normalizeProgressStatus(progress: number): TaskStatus {
  if (progress >= 100) return "done";
  if (progress > 0) return "inProgress";
  return "notStarted";
}

/** normalizeSummaryTasksを実行し、アプリケーション用の値を返します。 */
export function normalizeSummaryTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  const byParent = new Map<string | null, ScheduleTask[]>();
  tasks.forEach((task) => {
    byParent.set(task.parentId, [...(byParent.get(task.parentId) ?? []), task]);
  });

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const parentIds = [...taskMap.values()]
    .filter((task) => task.type === "summary" || task.type === "phase")
    .map((task) => task.id)
    .reverse();

  parentIds.forEach((parentId) => {
    const parent = taskMap.get(parentId);
    const children = (byParent.get(parentId) ?? [])
      .map((child) => taskMap.get(child.id))
      .filter((task): task is ScheduleTask => Boolean(task));
    if (!parent || children.length === 0) return;
    const actionableChildren = children.filter((child) => child.type !== "milestone");
    const sourceChildren = actionableChildren.length > 0 ? actionableChildren : children;
    const start = sourceChildren.reduce(
      (min, task) => (task.start < min ? task.start : min),
      sourceChildren[0].start,
    );
    const end = sourceChildren.reduce(
      (max, task) => (task.end > max ? task.end : max),
      sourceChildren[0].end,
    );
    const progress = Math.round(
      sourceChildren.reduce((sum, task) => sum + task.progress, 0) / sourceChildren.length,
    );
    const status = deriveStatus(sourceChildren, progress);
    taskMap.set(parentId, {
      ...parent,
      start,
      end,
      progress,
      status,
    });
  });

  return tasks.map((task) => taskMap.get(task.id) ?? task);
}

function deriveStatus(tasks: ScheduleTask[], progress: number): TaskStatus {
  if (tasks.some((task) => task.status === "delayed")) return "delayed";
  if (tasks.every((task) => task.status === "done")) return "done";
  if (progress > 0 || tasks.some((task) => task.status === "inProgress")) {
    return "inProgress";
  }
  return "notStarted";
}

/** getDurationDaysを実行し、アプリケーション用の値を返します。 */
export function getDurationDays(task: ScheduleTask): number {
  return Math.max(daysInclusive(task.start, task.end), 1);
}

function applyTaskPatch(
  task: ScheduleTask,
  patch: Partial<ScheduleTask>,
  calendar?: CalendarDefinition,
  calendarAware = true,
): ScheduleTask {
  const next = { ...task, ...patch };
  if (next.type === "milestone") {
    return { ...next, end: next.start };
  }

  const startChanged = typeof patch.start === "string" && patch.start !== task.start;
  const endChanged = typeof patch.end === "string" && patch.end !== task.end;

  if (endChanged) {
    const requestedWorkDays = getRequestedWorkDays(next.start, next.end);
    return {
      ...next,
      end: resolveEndForWorkDays(next.start, requestedWorkDays, calendar, calendarAware),
    };
  }

  if (startChanged) {
    const workDays = getTaskWorkDays(task, calendar, calendarAware);
    return {
      ...next,
      end: resolveEndForWorkDays(next.start, workDays, calendar, calendarAware),
    };
  }

  return normalizeTaskDates(next);
}

function getRequestedWorkDays(start: string, end: string): number {
  const safeEnd = end < start ? start : end;
  return Math.max(daysInclusive(start, safeEnd), 1);
}

function getTaskWorkDays(
  task: ScheduleTask,
  calendar?: CalendarDefinition,
  calendarAware = true,
): number {
  if (!calendar) return getDurationDays(task);
  return getWorkingDaySpan(task.start, task.end, calendar, calendarAware);
}

function resolveEndForWorkDays(
  start: string,
  workDays: number,
  calendar?: CalendarDefinition,
  calendarAware = true,
): string {
  const duration = Math.max(Math.round(workDays), 1);
  if (!calendar) {
    return toDateKey(addDays(parseDate(start), duration - 1));
  }
  return extendEndForWorkingDays(start, duration, calendar, calendarAware);
}
