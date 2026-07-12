import { type Dispatch, type SetStateAction, useCallback } from "react";

import type { ScheduleWorkspace } from "../../../data/scheduleRepository";
import type {
  ActivityCategory,
  ActivityTone,
  ProjectIssue,
  ProjectWorkLog,
} from "../../../types/schedule";

type UseProjectActivityActionsOptions = {
  currentUserName: string;
  defaultMemberId?: string;
  onActivity: (input: {
    category: ActivityCategory;
    detail: string;
    taskId?: string;
    title: string;
    tone?: ActivityTone;
  }) => void;
  onToast: (input: {
    detail?: string;
    title: string;
    tone?: "info" | "success" | "warning";
  }) => void;
  projectId: string;
  projectName: string;
  selectedTaskId: string | null;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
};

/**
 * 課題と作業時間の作成・更新・削除を管理します。
 * Gantt固有の履歴処理とは分離し、プロジェクト運用データの更新境界を明確にします。
 */
export function useProjectActivityActions({
  currentUserName,
  defaultMemberId,
  onActivity,
  onToast,
  projectId,
  projectName,
  selectedTaskId,
  setWorkspace,
}: UseProjectActivityActionsOptions) {
  const commitProjectIssues = useCallback(
    (updater: (current: ProjectIssue[]) => ProjectIssue[]) => {
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.id === projectId
            ? { ...snapshot, issues: updater(snapshot.issues ?? []) }
            : snapshot,
        ),
      }));
    },
    [projectId, setWorkspace],
  );

  const createProjectIssue = useCallback(
    (patch: Partial<ProjectIssue> = {}) => {
      const now = new Date().toISOString();
      const issueId = `issue-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`;
      const relatedTaskIds = patch.taskIds ?? (selectedTaskId ? [selectedTaskId] : []);
      const nextIssue: ProjectIssue = {
        ...patch,
        assigneeIds: patch.assigneeIds ?? [],
        body: patch.body ?? "",
        closedAt: patch.closedAt,
        createdAt: now,
        github: patch.github ?? { syncStatus: "unlinked" },
        id: issueId,
        priority: patch.priority ?? "medium",
        replies: patch.replies ?? [],
        status: patch.status ?? "open",
        taskIds: relatedTaskIds,
        title: patch.title ?? "新しい課題",
        type: patch.type ?? "task",
        updatedAt: now,
      };
      commitProjectIssues((current) => [nextIssue, ...current]);
      onToast({
        detail:
          relatedTaskIds.length > 0
            ? "選択中のタスクに紐付けました"
            : "課題一覧から内容や担当を確認できます",
        title: "課題を追加しました",
      });
      onActivity({
        category: "issue",
        detail: `${projectName} に課題を追加しました。`,
        title: "課題を追加しました",
        tone: "success",
      });
      return issueId;
    },
    [commitProjectIssues, onActivity, onToast, projectName, selectedTaskId],
  );

  const updateProjectIssue = useCallback(
    (issueId: string, patch: Partial<ProjectIssue>) => {
      const now = new Date().toISOString();
      commitProjectIssues((current) =>
        current.map((issue) => {
          if (issue.id !== issueId) {
            return issue;
          }
          const nextStatus = patch.status ?? issue.status;
          return {
            ...issue,
            ...patch,
            closedAt:
              nextStatus === "closed" || nextStatus === "resolved"
                ? (patch.closedAt ?? issue.closedAt ?? now)
                : undefined,
            updatedAt: now,
          };
        }),
      );
    },
    [commitProjectIssues],
  );

  const commitProjectWorkLogs = useCallback(
    (updater: (current: ProjectWorkLog[]) => ProjectWorkLog[]) => {
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.id === projectId
            ? { ...snapshot, workLogs: updater(snapshot.workLogs ?? []) }
            : snapshot,
        ),
      }));
    },
    [projectId, setWorkspace],
  );

  const createProjectWorkLog = useCallback(
    (patch: Partial<ProjectWorkLog> = {}) => {
      const now = new Date().toISOString();
      const workLogId = `worklog-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`;
      const nextWorkLog: ProjectWorkLog = {
        billable: patch.billable ?? true,
        category: patch.category ?? "maintenance",
        createdAt: now,
        createdBy: patch.createdBy ?? currentUserName,
        date: patch.date ?? now.slice(0, 10),
        hours: patch.hours ?? 0,
        id: workLogId,
        issueId: patch.issueId,
        memberId: patch.memberId ?? defaultMemberId ?? "",
        note: patch.note,
        summary: patch.summary ?? "運用保守対応",
        taskId: patch.taskId,
        updatedAt: now,
      };
      commitProjectWorkLogs((current) => [nextWorkLog, ...current]);
      onToast({
        detail: `${nextWorkLog.summary} / ${nextWorkLog.hours}h`,
        title: "作業時間を記録しました",
        tone: "success",
      });
      onActivity({
        category: "workLog",
        detail: `${projectName} に ${nextWorkLog.hours}h の作業時間を記録しました。`,
        title: "作業時間を記録しました",
        tone: "success",
      });
      return workLogId;
    },
    [commitProjectWorkLogs, currentUserName, defaultMemberId, onActivity, onToast, projectName],
  );

  const updateProjectWorkLog = useCallback(
    (workLogId: string, patch: Partial<ProjectWorkLog>) => {
      const now = new Date().toISOString();
      commitProjectWorkLogs((current) =>
        current.map((workLog) =>
          workLog.id === workLogId ? { ...workLog, ...patch, updatedAt: now } : workLog,
        ),
      );
    },
    [commitProjectWorkLogs],
  );

  const deleteProjectWorkLog = useCallback(
    (workLogId: string) => {
      commitProjectWorkLogs((current) => current.filter((workLog) => workLog.id !== workLogId));
      onToast({
        detail: "作業時間ログから削除しました",
        title: "作業時間を削除しました",
        tone: "warning",
      });
      onActivity({
        category: "workLog",
        detail: `${projectName} の作業時間を削除しました。`,
        title: "作業時間を削除しました",
        tone: "warning",
      });
    },
    [commitProjectWorkLogs, onActivity, onToast, projectName],
  );

  return {
    commitProjectIssues,
    commitProjectWorkLogs,
    createProjectIssue,
    createProjectWorkLog,
    deleteProjectWorkLog,
    updateProjectIssue,
    updateProjectWorkLog,
  };
}
