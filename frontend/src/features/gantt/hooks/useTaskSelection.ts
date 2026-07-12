import { useCallback, useState } from "react";

import type { TaskInspectorFocusTarget } from "../../../types/schedule";
import type { TaskFocusRequest, TaskSelectionOptions } from "../types/ganttState";

type SelectionRow = { id: string };

type UseTaskSelectionOptions = {
  visibleRows: SelectionRow[];
};

/**
 * Ganttの単一選択、範囲選択、詳細パネルのフォーカス要求を管理します。
 * 行の描画やタスク更新から選択状態を分離し、キーボード操作を再利用しやすくします。
 */
export function useTaskSelection({ visibleRows }: UseTaskSelectionOptions) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [taskInspectorTaskId, setTaskInspectorTaskId] = useState<string | null>(null);
  const [taskFocusRequest, setTaskFocusRequest] = useState<TaskFocusRequest | null>(null);
  const [selectionAnchorTaskId, setSelectionAnchorTaskId] = useState<string | null>(null);

  const closeTaskInspector = useCallback(() => {
    setTaskInspectorTaskId(null);
    setTaskFocusRequest(null);
  }, []);

  const openTaskInspector = useCallback((taskId: string, target?: TaskInspectorFocusTarget) => {
    setTaskInspectorTaskId(taskId);
    if (!target) {
      setTaskFocusRequest(null);
      return;
    }
    setTaskFocusRequest((current) => ({
      requestId: (current?.requestId ?? 0) + 1,
      target,
      taskId,
    }));
  }, []);

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskId(null);
    setSelectedTaskIds(new Set());
    setSelectionAnchorTaskId(null);
    closeTaskInspector();
  }, [closeTaskInspector]);

  const selectOnlyTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    setSelectedTaskIds(taskId ? new Set([taskId]) : new Set());
    setSelectionAnchorTaskId(taskId);
    setTaskInspectorTaskId((current) => (current === taskId ? current : null));
    setTaskFocusRequest(null);
  }, []);

  const selectTask = useCallback(
    (taskId: string, options: TaskSelectionOptions = {}) => {
      if (options.range && selectionAnchorTaskId) {
        const anchorIndex = visibleRows.findIndex((row) => row.id === selectionAnchorTaskId);
        const targetIndex = visibleRows.findIndex((row) => row.id === taskId);
        if (anchorIndex !== -1 && targetIndex !== -1) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          const ids = visibleRows.slice(start, end + 1).map((row) => row.id);
          setSelectedTaskId(taskId);
          setSelectedTaskIds(new Set(ids));
          if (options.focusTarget) {
            openTaskInspector(taskId, options.focusTarget);
          } else {
            closeTaskInspector();
          }
          return;
        }
      }

      if (options.additive) {
        if (!options.focusTarget) {
          closeTaskInspector();
        }
        setSelectedTaskIds((current) => {
          const next = new Set(current);
          if (next.has(taskId) && next.size > 1) {
            next.delete(taskId);
            setSelectedTaskId([...next].at(-1) ?? null);
          } else {
            next.add(taskId);
            setSelectedTaskId(taskId);
            setSelectionAnchorTaskId(taskId);
          }
          return next;
        });
        if (options.focusTarget) {
          openTaskInspector(taskId, options.focusTarget);
        }
        return;
      }

      selectOnlyTask(taskId);
      if (options.focusTarget) {
        openTaskInspector(taskId, options.focusTarget);
      }
    },
    [closeTaskInspector, openTaskInspector, selectOnlyTask, selectionAnchorTaskId, visibleRows],
  );

  const selectTaskRange = useCallback(
    (startTaskId: string, endTaskId: string) => {
      const startIndex = visibleRows.findIndex((row) => row.id === startTaskId);
      const endIndex = visibleRows.findIndex((row) => row.id === endTaskId);
      if (startIndex === -1 || endIndex === -1) {
        return;
      }

      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const ids = visibleRows.slice(start, end + 1).map((row) => row.id);
      setSelectedTaskId(endTaskId);
      setSelectedTaskIds(new Set(ids));
      setSelectionAnchorTaskId(startTaskId);
      closeTaskInspector();
    },
    [closeTaskInspector, visibleRows],
  );

  const selectTaskIds = useCallback((ids: string[], anchorId = ids[0] ?? null) => {
    setSelectedTaskId(ids.at(-1) ?? null);
    setSelectedTaskIds(new Set(ids));
    setSelectionAnchorTaskId(anchorId);
  }, []);

  return {
    clearTaskSelection,
    closeTaskInspector,
    openTaskInspector,
    selectOnlyTask,
    selectTask,
    selectTaskIds,
    selectTaskRange,
    selectedTaskId,
    selectedTaskIds,
    selectionAnchorTaskId,
    taskFocusRequest,
    taskInspectorTaskId,
  };
}
