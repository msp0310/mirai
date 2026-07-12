import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TaskSiblingReorderPlacement } from "../../../lib/taskOperations";
import type { ScheduleTask, TaskRow } from "../../../types/schedule";
import { rowHeight } from "../components/constants";
import {
  buildTaskChildrenMap,
  getMovingSubtreeIds,
  getReorderRootIds,
  getReorderTaskIds,
  getTaskRowReorderMode,
  getVisibleSubtreeEndIndex,
} from "../lib/taskTableModel";
import type { TaskRowReorderState, TaskTableSortKey } from "../types/ganttState";

type RowReorderSession = {
  active: boolean;
  draggingTaskIds: string[];
  pointerId: number;
  sourceTaskId: string;
  startX: number;
  startY: number;
};

type UseTaskRowReorderOptions = {
  clearDragSelection: () => void;
  displayMode: "gantt" | "table";
  displayRows: TaskRow[];
  onInteractionStart: () => void;
  onReorderTasksToTarget: (
    targetTaskId: string,
    placement: TaskSiblingReorderPlacement,
    taskIds: string[],
  ) => void;
  onReparentTasksByDrag: (
    targetParentId: string | null,
    taskIds: string[],
    referenceTaskId?: string | null,
    placement?: TaskSiblingReorderPlacement,
  ) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskIds: Set<string>;
  setSynchronizedScrollTop: (scrollTop: number) => void;
  suppressNextClick: () => void;
  tableRef: RefObject<HTMLDivElement | null>;
  tableSortKey: TaskTableSortKey | null;
  tasks: ScheduleTask[];
};

/** 行の上下移動・子階層化・親階層化を伴うドラッグ操作を管理します。 */
export function useTaskRowReorder({
  clearDragSelection,
  displayMode,
  displayRows,
  onInteractionStart,
  onReorderTasksToTarget,
  onReparentTasksByDrag,
  onSelectTask,
  selectedTaskIds,
  setSynchronizedScrollTop,
  suppressNextClick,
  tableRef,
  tableSortKey,
  tasks,
}: UseTaskRowReorderOptions) {
  const [rowReorder, setRowReorder] = useState<TaskRowReorderState | null>(null);
  const sessionRef = useRef<RowReorderSession | null>(null);
  const listenersRef = useRef<AbortController | null>(null);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const taskChildrenByParentId = useMemo(() => buildTaskChildrenMap(tasks), [tasks]);

  const rowReorderGuide = useMemo(() => {
    if (!rowReorder?.targetTaskId) {
      return null;
    }
    const guideTaskId =
      rowReorder.mode === "outdent" ? rowReorder.referenceTaskId : rowReorder.targetTaskId;
    const targetIndex = displayRows.findIndex((row) => row.id === guideTaskId);
    if (targetIndex === -1) {
      return null;
    }
    const targetRow = displayRows[targetIndex];
    let guideIndex = targetIndex;
    if (targetRow && (rowReorder.mode === "child" || rowReorder.mode === "outdent")) {
      guideIndex = getVisibleSubtreeEndIndex(displayRows, targetIndex);
    }
    return {
      label: rowReorder.valid
        ? rowReorder.mode === "child"
          ? "子階層へ入れる"
          : rowReorder.mode === "outdent"
            ? "親階層へ出す"
            : "ここへ移動"
        : rowReorder.reason,
      top: (rowReorder.placement === "after" ? guideIndex + 1 : guideIndex) * rowHeight,
      valid: rowReorder.valid,
    };
  }, [displayRows, rowReorder]);

  const getTaskIndexFromClientY = useCallback(
    (clientY: number) => {
      const table = tableRef.current;
      if (!table || displayRows.length === 0) {
        return -1;
      }
      const y = clientY - table.getBoundingClientRect().top + table.scrollTop;
      return Math.min(Math.max(Math.floor(y / rowHeight), 0), displayRows.length - 1);
    },
    [displayRows.length, tableRef],
  );

  const getRowReorderPlacement = useCallback(
    (clientY: number, targetIndex: number): TaskSiblingReorderPlacement => {
      const table = tableRef.current;
      if (!table) {
        return "before";
      }
      const y = clientY - table.getBoundingClientRect().top + table.scrollTop;
      return y - targetIndex * rowHeight > rowHeight / 2 ? "after" : "before";
    },
    [tableRef],
  );

  const getRowReorderState = useCallback(
    (
      clientX: number,
      clientY: number,
      sourceTaskId: string,
      draggingTaskIds: string[],
      startX: number,
    ): TaskRowReorderState => {
      const targetIndex = getTaskIndexFromClientY(clientY);
      const targetRow = targetIndex >= 0 ? displayRows[targetIndex] : undefined;
      const placement = getRowReorderPlacement(clientY, Math.max(targetIndex, 0));
      const mode = getTaskRowReorderMode(clientX, startX);
      if (!targetRow) {
        return {
          draggingTaskIds,
          mode,
          placement,
          referenceTaskId: null,
          reason: "移動先なし",
          sourceTaskId,
          targetParentId: null,
          targetTaskId: null,
          valid: false,
        };
      }

      const targetTask = taskById.get(targetRow.id);
      const rootIds = getReorderRootIds(tasks, draggingTaskIds, taskById);
      const rootTasks = rootIds
        .map((taskId) => taskById.get(taskId))
        .filter((task): task is ScheduleTask => Boolean(task));
      const selectedIds = new Set(draggingTaskIds);
      const movingSubtreeIds = getMovingSubtreeIds(rootIds, taskChildrenByParentId);
      const targetIsMovingSubtree = movingSubtreeIds.has(targetRow.id);
      const sameParent =
        targetTask !== undefined &&
        rootTasks.length > 0 &&
        rootTasks.every((task) => task.parentId === targetTask.parentId);
      const targetIsSelected = selectedIds.has(targetRow.id);

      if (mode === "child") {
        const canNest =
          targetTask !== undefined &&
          targetTask.type !== "milestone" &&
          rootTasks.length > 0 &&
          !targetIsMovingSubtree;
        return {
          draggingTaskIds,
          mode,
          placement: "after",
          referenceTaskId: null,
          reason: targetIsMovingSubtree
            ? "選択行の外へ"
            : targetTask?.type === "milestone"
              ? "マイルストーン不可"
              : "子階層へ入れる",
          sourceTaskId,
          targetParentId: targetTask?.id ?? null,
          targetTaskId: targetRow.id,
          valid: canNest,
        };
      }

      if (mode === "outdent") {
        const parentIds = [...new Set(rootTasks.map((task) => task.parentId))];
        const sourceParentId = parentIds.length === 1 ? parentIds[0] : null;
        const sourceParent = sourceParentId ? taskById.get(sourceParentId) : undefined;
        return {
          draggingTaskIds,
          mode,
          placement: "after",
          referenceTaskId: sourceParent?.id ?? null,
          reason: parentIds.length > 1 ? "同じ親の行のみ" : "親階層へ出す",
          sourceTaskId,
          targetParentId: sourceParent?.parentId ?? null,
          targetTaskId: sourceParent?.id ?? targetRow.id,
          valid: rootTasks.length > 0 && parentIds.length === 1 && Boolean(sourceParent),
        };
      }

      return {
        draggingTaskIds,
        mode,
        placement,
        referenceTaskId: null,
        reason: targetIsSelected ? "選択行の外へ" : "同階層のみ",
        sourceTaskId,
        targetParentId: targetTask?.parentId ?? null,
        targetTaskId: targetRow.id,
        valid: sameParent && !targetIsSelected,
      };
    },
    [
      displayRows,
      getRowReorderPlacement,
      getTaskIndexFromClientY,
      taskById,
      taskChildrenByParentId,
      tasks,
    ],
  );

  const autoScrollTaskTable = useCallback(
    (clientY: number) => {
      const table = tableRef.current;
      if (!table) {
        return;
      }
      const tableRect = table.getBoundingClientRect();
      const edgeSize = 42;
      const delta =
        clientY < tableRect.top + edgeSize
          ? -rowHeight
          : clientY > tableRect.bottom - edgeSize
            ? rowHeight
            : 0;
      if (delta === 0) {
        return;
      }
      const nextScrollTop = Math.min(
        Math.max(table.scrollTop + delta, 0),
        table.scrollHeight - table.clientHeight,
      );
      if (nextScrollTop !== table.scrollTop) {
        setSynchronizedScrollTop(nextScrollTop);
      }
    },
    [setSynchronizedScrollTop, tableRef],
  );

  const handleRowReorderPointerDown = useCallback(
    (taskId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || (displayMode === "table" && tableSortKey !== null)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const draggingTaskIds = getReorderTaskIds(tasks, selectedTaskIds, taskId);
      if (!selectedTaskIds.has(taskId)) {
        onSelectTask(taskId);
      }
      onInteractionStart();
      clearDragSelection();
      sessionRef.current = {
        active: false,
        draggingTaskIds,
        pointerId: event.pointerId,
        sourceTaskId: taskId,
        startX: event.clientX,
        startY: event.clientY,
      };
      listenersRef.current?.abort();
      const listeners = new AbortController();
      listenersRef.current = listeners;

      function handlePointerMove(pointerEvent: PointerEvent) {
        const session = sessionRef.current;
        if (!session || pointerEvent.pointerId !== session.pointerId) {
          return;
        }
        const distance = Math.hypot(
          pointerEvent.clientX - session.startX,
          pointerEvent.clientY - session.startY,
        );
        if (!session.active && distance < 5) {
          return;
        }
        if (!session.active) {
          session.active = true;
          window.getSelection()?.removeAllRanges();
        }
        pointerEvent.preventDefault();
        autoScrollTaskTable(pointerEvent.clientY);
        setRowReorder(
          getRowReorderState(
            pointerEvent.clientX,
            pointerEvent.clientY,
            session.sourceTaskId,
            session.draggingTaskIds,
            session.startX,
          ),
        );
      }

      function handlePointerEnd(pointerEvent: PointerEvent) {
        const session = sessionRef.current;
        if (!session || pointerEvent.pointerId !== session.pointerId) {
          return;
        }
        listeners.abort();
        if (session.active) {
          const dropState = getRowReorderState(
            pointerEvent.clientX,
            pointerEvent.clientY,
            session.sourceTaskId,
            session.draggingTaskIds,
            session.startX,
          );
          if (dropState.valid && dropState.targetTaskId) {
            if (dropState.mode === "sibling") {
              onReorderTasksToTarget(
                dropState.targetTaskId,
                dropState.placement,
                session.draggingTaskIds,
              );
            } else {
              onReparentTasksByDrag(
                dropState.targetParentId,
                session.draggingTaskIds,
                dropState.referenceTaskId,
                dropState.placement,
              );
            }
          }
          suppressNextClick();
        }
        sessionRef.current = null;
        setRowReorder(null);
      }

      document.addEventListener("pointermove", handlePointerMove, { signal: listeners.signal });
      document.addEventListener("pointerup", handlePointerEnd, { signal: listeners.signal });
      document.addEventListener("pointercancel", handlePointerEnd, { signal: listeners.signal });
    },
    [
      autoScrollTaskTable,
      clearDragSelection,
      displayMode,
      getRowReorderState,
      onInteractionStart,
      onReorderTasksToTarget,
      onReparentTasksByDrag,
      onSelectTask,
      selectedTaskIds,
      suppressNextClick,
      tableSortKey,
      tasks,
    ],
  );

  useEffect(
    () => () => {
      listenersRef.current?.abort();
    },
    [],
  );

  return { handleRowReorderPointerDown, rowReorder, rowReorderGuide };
}
