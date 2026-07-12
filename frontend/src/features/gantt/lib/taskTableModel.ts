import type { Member, ScheduleTask, TaskRow, TaskStatus } from "../../../types/schedule";
import type { TaskRowReorderMode, TaskTableSortState } from "../types/ganttState";

export function getTaskRowReorderMode(clientX: number, startX: number): TaskRowReorderMode {
  const deltaX = clientX - startX;
  if (deltaX > 34) {
    return "child";
  }
  if (deltaX < -34) {
    return "outdent";
  }
  return "sibling";
}

/** 親子関係を一度だけ走査し、子孫探索に使う隣接Mapを作ります。 */
export function buildTaskChildrenMap(tasks: ScheduleTask[]) {
  const childrenByParentId = new Map<string, ScheduleTask[]>();
  tasks.forEach((task) => {
    if (!task.parentId) {
      return;
    }
    const children = childrenByParentId.get(task.parentId) ?? [];
    children.push(task);
    childrenByParentId.set(task.parentId, children);
  });
  return childrenByParentId;
}

export function getDescendantTaskIds(
  taskId: string,
  childrenByParentId: Map<string, ScheduleTask[]>,
) {
  const ids = new Set<string>();
  const pending = [...(childrenByParentId.get(taskId) ?? [])];
  while (pending.length > 0) {
    const task = pending.pop();
    if (!task) {
      continue;
    }
    ids.add(task.id);
    pending.push(...(childrenByParentId.get(task.id) ?? []));
  }
  return ids;
}

export function getMovingSubtreeIds(
  rootIds: string[],
  childrenByParentId: Map<string, ScheduleTask[]>,
) {
  const ids = new Set<string>();
  rootIds.forEach((taskId) => {
    ids.add(taskId);
    getDescendantTaskIds(taskId, childrenByParentId).forEach((id) => ids.add(id));
  });
  return ids;
}

export function getReorderRootIds(
  tasks: ScheduleTask[],
  taskIds: string[],
  taskById: Map<string, ScheduleTask>,
) {
  const selectedIds = new Set(taskIds);
  return tasks
    .filter(
      (task) => selectedIds.has(task.id) && !hasSelectedAncestor(task.id, selectedIds, taskById),
    )
    .map((task) => task.id);
}

export function getReorderTaskIds(
  tasks: ScheduleTask[],
  selectedTaskIds: Set<string>,
  sourceTaskId: string,
) {
  if (!selectedTaskIds.has(sourceTaskId)) {
    return [sourceTaskId];
  }
  return tasks.filter((task) => selectedTaskIds.has(task.id)).map((task) => task.id);
}

export function getVisibleSubtreeEndIndex(rows: TaskRow[], startIndex: number) {
  const startRow = rows[startIndex];
  if (!startRow) {
    return startIndex;
  }
  let endIndex = startIndex;
  for (let index = startIndex + 1; index < rows.length; index += 1) {
    if (rows[index].depth <= startRow.depth) {
      break;
    }
    endIndex = index;
  }
  return endIndex;
}

/** 階層ブロックを壊さず、各階層の兄弟だけを指定列で並べ替えます。 */
export function sortTaskRowsPreservingHierarchy(
  rows: TaskRow[],
  sort: TaskTableSortState,
  members: Member[],
) {
  if (!sort.key || rows.length < 2) {
    return rows;
  }

  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const statusOrder: Record<TaskStatus, number> = {
    notStarted: 0,
    inProgress: 1,
    delayed: 2,
    done: 3,
  };

  function compare(left: TaskRow, right: TaskRow) {
    let result = 0;
    if (sort.key === "title") {
      result = left.title.localeCompare(right.title, "ja");
    } else if (sort.key === "start") {
      result = left.start.localeCompare(right.start) || left.end.localeCompare(right.end);
    } else if (sort.key === "end") {
      result = left.end.localeCompare(right.end) || left.start.localeCompare(right.start);
    } else if (sort.key === "assignee") {
      const leftAssignee = memberNames.get(left.assigneeIds[0] ?? "") ?? "未割当";
      const rightAssignee = memberNames.get(right.assigneeIds[0] ?? "") ?? "未割当";
      result = leftAssignee.localeCompare(rightAssignee, "ja");
    } else if (sort.key === "status") {
      result = statusOrder[left.status] - statusOrder[right.status];
    } else {
      result = left.progress - right.progress;
    }
    return (sort.direction === "asc" ? result : -result) || left.id.localeCompare(right.id);
  }

  function sortLevel(startIndex: number, depth: number): { nextIndex: number; rows: TaskRow[] } {
    const blocks: { root: TaskRow; rows: TaskRow[] }[] = [];
    let index = startIndex;
    while (index < rows.length && rows[index]?.depth === depth) {
      const root = rows[index];
      if (!root) {
        break;
      }
      index += 1;
      const children = sortLevel(index, depth + 1);
      index = children.nextIndex;
      blocks.push({ root, rows: [root, ...children.rows] });
    }
    blocks.sort((left, right) => compare(left.root, right.root));
    return {
      nextIndex: index,
      rows: blocks.flatMap((block) => block.rows),
    };
  }

  return sortLevel(0, rows[0]?.depth ?? 0).rows;
}

function hasSelectedAncestor(
  taskId: string,
  selectedIds: Set<string>,
  taskById: Map<string, ScheduleTask>,
) {
  let parentId = taskById.get(taskId)?.parentId;
  while (parentId) {
    if (selectedIds.has(parentId)) {
      return true;
    }
    parentId = taskById.get(parentId)?.parentId;
  }
  return false;
}
