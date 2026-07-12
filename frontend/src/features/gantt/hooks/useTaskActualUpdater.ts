import { type Dispatch, type SetStateAction, useCallback } from "react";

import { apiScheduleRepository } from "../../../data/apiScheduleRepository";
import type { ScheduleWorkspace } from "../../../data/scheduleRepository";
import { mergeScheduleIntoWorkspace } from "../../../lib/scheduleWorkspace";
import type { ScheduleTask } from "../../../types/schedule";

type UseTaskActualUpdaterOptions = {
  onReplaceProject: (projectId: string, tasks: ScheduleTask[]) => void;
  onToast: (input: {
    detail?: string;
    title: string;
    tone?: "info" | "success" | "warning";
  }) => void;
  projectId: string;
  projectVersion?: number;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  tasks: ScheduleTask[];
};

/** 担当タスクの実績更新をAPIへ送り、最新案件スナップショットへ置き換えます。 */
export function useTaskActualUpdater({
  onReplaceProject,
  onToast,
  projectId,
  projectVersion,
  setWorkspace,
  tasks,
}: UseTaskActualUpdaterOptions) {
  return useCallback(
    (taskId: string, patch: Partial<ScheduleTask>) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (!currentTask) {
        return;
      }

      void apiScheduleRepository
        .updateTaskActual(
          projectId,
          taskId,
          {
            actualEnd: patch.actualEnd ?? currentTask.actualEnd,
            actualStart: patch.actualStart ?? currentTask.actualStart,
            progress: patch.progress ?? currentTask.progress,
            status: patch.status ?? currentTask.status,
          },
          projectVersion,
        )
        .then((saved) => {
          setWorkspace((current) => mergeScheduleIntoWorkspace(current, saved));
          onReplaceProject(saved.project.id, saved.tasks);
          onToast({ title: "タスク実績を保存しました", tone: "success" });
        })
        .catch((error: unknown) =>
          onToast({
            detail: error instanceof Error ? error.message : "保存できませんでした。",
            title: "タスク実績の保存に失敗しました",
            tone: "warning",
          }),
        );
    },
    [onReplaceProject, onToast, projectId, projectVersion, setWorkspace, tasks],
  );
}
