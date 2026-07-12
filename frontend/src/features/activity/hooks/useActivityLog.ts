import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivityInput } from "../../../types/activity";
import type { ActivityLogEntry } from "../../../types/schedule";

type UseActivityLogOptions = {
  actor: string;
  activeProjectId: string;
  initialLogs: Record<string, ActivityLogEntry[]>;
};

/** 案件単位の操作履歴、ID採番、最新値参照を一つの境界で管理します。 */
export function useActivityLog({ actor, activeProjectId, initialLogs }: UseActivityLogOptions) {
  const [activityLogs, setActivityLogs] = useState(initialLogs);
  const activityLogsRef = useRef(activityLogs);
  const activityIdRef = useRef(0);

  useEffect(() => {
    activityLogsRef.current = activityLogs;
  }, [activityLogs]);

  const replaceActivityLogs = useCallback((logs: Record<string, ActivityLogEntry[]>) => {
    activityLogsRef.current = logs;
    setActivityLogs(logs);
  }, []);

  const createActivityEntry = useCallback(
    ({
      category,
      detail,
      projectId = activeProjectId,
      taskId,
      title,
      tone = "info",
    }: ActivityInput): ActivityLogEntry => {
      const nextIndex = activityIdRef.current + 1;
      activityIdRef.current = nextIndex;
      const happenedAt = new Date().toISOString();
      return {
        actor,
        category,
        detail,
        happenedAt,
        id: `${projectId}-${happenedAt}-${nextIndex}`,
        projectId,
        taskId,
        title,
        tone,
      };
    },
    [activeProjectId, actor],
  );

  const appendActivityEntry = useCallback(
    (entry: ActivityLogEntry) => {
      const { current } = activityLogsRef;
      const nextLogs = {
        ...current,
        [entry.projectId]: [entry, ...(current[entry.projectId] ?? [])].slice(0, 160),
      };
      replaceActivityLogs(nextLogs);
      return nextLogs;
    },
    [replaceActivityLogs],
  );

  const recordActivity = useCallback(
    (input: ActivityInput) => {
      appendActivityEntry(createActivityEntry(input));
    },
    [appendActivityEntry, createActivityEntry],
  );

  return {
    activityLogs,
    appendActivityEntry,
    createActivityEntry,
    recordActivity,
  };
}
