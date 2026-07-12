import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { ScheduleFilters, TaskStatus } from "../types/schedule";

export type CollapsedIdUpdate = Set<string> | ((current: Set<string>) => Set<string>);

type UseWorkbenchGanttControlsOptions = {
  activeProjectId: string;
  setCollapsedIdsByProject: Dispatch<SetStateAction<Record<string, string[]>>>;
  setFilters: Dispatch<SetStateAction<ScheduleFilters>>;
};

/** 案件ごとの折りたたみ状態と、Ganttフィルターの更新規則を管理します。 */
export function useWorkbenchGanttControls({
  activeProjectId,
  setCollapsedIdsByProject,
  setFilters,
}: UseWorkbenchGanttControlsOptions) {
  const setCollapsedIdsForProject = useCallback(
    (projectId: string, update: CollapsedIdUpdate) => {
      setCollapsedIdsByProject((current) => {
        const currentSet = new Set(current[projectId]);
        const nextSet = typeof update === "function" ? update(currentSet) : new Set(update);
        const nextIds = [...nextSet].toSorted();
        const { [projectId]: previousProjectIds, ...rest } = current;
        if (nextIds.length === 0) {
          return previousProjectIds === undefined ? current : rest;
        }
        const previousIds = previousProjectIds ?? [];
        if (
          previousIds.length === nextIds.length &&
          previousIds.every((id, index) => id === nextIds[index])
        ) {
          return current;
        }
        return { ...current, [projectId]: nextIds };
      });
    },
    [setCollapsedIdsByProject],
  );

  const setCollapsedIds = useCallback(
    (update: CollapsedIdUpdate) => setCollapsedIdsForProject(activeProjectId, update),
    [activeProjectId, setCollapsedIdsForProject],
  );

  const toggleCollapsed = useCallback(
    (taskId: string) => {
      setCollapsedIds((current) => {
        const next = new Set(current);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    },
    [setCollapsedIds],
  );

  const updateStatusFilter = useCallback(
    (status: TaskStatus) => {
      setFilters((current) => ({
        ...current,
        statuses: { ...current.statuses, [status]: !current.statuses[status] },
      }));
    },
    [setFilters],
  );

  return { setCollapsedIds, setCollapsedIdsForProject, toggleCollapsed, updateStatusFilter };
}
