import { useCallback, useState } from "react";

import type { TaskHistory } from "../../../app/appTypes";
import { normalizeSummaryTasks } from "../../../lib/taskOperations";
import type { ActivityCategory, ActivityTone, ScheduleTask } from "../../../types/schedule";

type UseTaskHistoryOptions = {
  initialHistories: Record<string, TaskHistory>;
  onActivity: (input: {
    category: ActivityCategory;
    detail: string;
    title: string;
    tone?: ActivityTone;
  }) => void;
  onToast: (input: { title: string; tone?: "info" | "success" | "warning" }) => void;
  projectId: string;
  sourceTasks: ScheduleTask[];
};

/**
 * 案件単位のタスク履歴とUndo/Redoを管理します。
 * ワークベンチ本体は履歴配列の構造を知らず、差分操作だけを依頼できます。
 */
export function useTaskHistory({
  initialHistories,
  onActivity,
  onToast,
  projectId,
  sourceTasks,
}: UseTaskHistoryOptions) {
  const [histories, setHistories] = useState(initialHistories);

  const taskHistory =
    histories[projectId] ??
    ({
      future: [],
      past: [],
      present: normalizeSummaryTasks(sourceTasks),
    } satisfies TaskHistory);
  const tasks = taskHistory.present;

  const commitTasks = useCallback(
    (updater: (current: ScheduleTask[]) => ScheduleTask[]) => {
      setHistories((current) => {
        const history =
          current[projectId] ??
          ({
            future: [],
            past: [],
            present: normalizeSummaryTasks(sourceTasks),
          } satisfies TaskHistory);
        const next = updater(history.present);
        if (next === history.present) {
          return current;
        }
        return {
          ...current,
          [projectId]: {
            future: [],
            past: [...history.past.slice(-24), history.present],
            present: next,
          },
        };
      });
    },
    [projectId, sourceTasks],
  );

  const initializeProject = useCallback((nextProjectId: string, nextTasks: ScheduleTask[]) => {
    setHistories((current) =>
      current[nextProjectId]
        ? current
        : {
            ...current,
            [nextProjectId]: {
              future: [],
              past: [],
              present: normalizeSummaryTasks(nextTasks),
            },
          },
    );
  }, []);

  const replaceProject = useCallback((nextProjectId: string, nextTasks: ScheduleTask[]) => {
    setHistories((current) => ({
      ...current,
      [nextProjectId]: {
        future: [],
        past: [],
        present: normalizeSummaryTasks(nextTasks),
      },
    }));
  }, []);

  const undo = useCallback(() => {
    const previous = taskHistory.past.at(-1);
    if (!previous) {
      return;
    }
    setHistories((current) => {
      const history = current[projectId];
      if (!history) {
        return current;
      }
      return {
        ...current,
        [projectId]: {
          future: [history.present, ...history.future].slice(0, 24),
          past: history.past.slice(0, -1),
          present: previous,
        },
      };
    });
    onToast({ title: "元に戻しました", tone: "info" });
    onActivity({
      category: "task",
      detail: "直前のタスク操作を取り消しました。",
      title: "操作を元に戻しました",
      tone: "info",
    });
  }, [onActivity, onToast, projectId, taskHistory]);

  const redo = useCallback(() => {
    const [next] = taskHistory.future;
    if (!next) {
      return;
    }
    setHistories((current) => {
      const history = current[projectId];
      if (!history) {
        return current;
      }
      return {
        ...current,
        [projectId]: {
          future: history.future.slice(1),
          past: [...history.past.slice(-24), history.present],
          present: next,
        },
      };
    });
    onToast({ title: "やり直しました", tone: "info" });
    onActivity({
      category: "task",
      detail: "取り消したタスク操作を再実行しました。",
      title: "操作をやり直しました",
      tone: "info",
    });
  }, [onActivity, onToast, projectId, taskHistory]);

  return {
    commitTasks,
    initializeProject,
    replaceProject,
    redo,
    setHistories,
    taskHistory,
    taskHistories: histories,
    tasks,
    undo,
  };
}
