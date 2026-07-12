import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useCallback } from "react";

import { apiScheduleRepository } from "../../../data/apiScheduleRepository";
import type { ScheduleSnapshot, ScheduleWorkspace } from "../../../data/scheduleRepository";
import { mergeScheduleIntoWorkspace } from "../../../lib/scheduleWorkspace";
import type { ScheduleTask } from "../../../types/schedule";
import { projectQueryKeys } from "../../projects/api/projectQueries";

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

type TaskActual = Pick<ScheduleTask, "actualEnd" | "actualStart" | "progress" | "status">;

/** 担当タスクの実績更新をAPIへ送り、最新案件スナップショットへ置き換えます。 */
export function useTaskActualUpdater({
  onReplaceProject,
  onToast,
  projectId,
  projectVersion,
  setWorkspace,
  tasks,
}: UseTaskActualUpdaterOptions) {
  const queryClient = useQueryClient();
  const { mutate: updateActual } = useMutation({
    mutationFn: ({ actual, taskId }: { actual: TaskActual; taskId: string }) =>
      apiScheduleRepository.updateTaskActual(
        projectId,
        taskId,
        {
          actualEnd: actual.actualEnd,
          actualStart: actual.actualStart,
          progress: actual.progress,
          status: actual.status,
        },
        projectVersion,
      ),
    onError: (error: unknown) =>
      onToast({
        detail: error instanceof Error ? error.message : "保存できませんでした。",
        title: "タスク実績の保存に失敗しました",
        tone: "warning",
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<ScheduleSnapshot>(
        projectQueryKeys.schedule(saved.project.id),
        (current) => ({
          ...saved,
          attachments: current?.attachments,
          changeLogs: current?.changeLogs,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.workspaceSummary });
      setWorkspace((current) => mergeScheduleIntoWorkspace(current, saved));
      onReplaceProject(saved.project.id, saved.tasks);
      onToast({ title: "タスク実績を保存しました", tone: "success" });
    },
  });

  return useCallback(
    (taskId: string, patch: Partial<ScheduleTask>) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (!currentTask) {
        return;
      }

      updateActual({
        actual: {
          actualEnd: patch.actualEnd ?? currentTask.actualEnd,
          actualStart: patch.actualStart ?? currentTask.actualStart,
          progress: patch.progress ?? currentTask.progress,
          status: patch.status ?? currentTask.status,
        },
        taskId,
      });
    },
    [tasks, updateActual],
  );
}
