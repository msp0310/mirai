import { useCallback, useMemo, useState } from "react";

import type { AuthUser } from "../../../data/authRepository";
import type {
  Member,
  ProjectIssue,
  ProjectIssueReply,
  ProjectIssueStatus,
  ScheduleTask,
} from "../../../types/schedule";
import {
  cloneIssue,
  createBlankIssueDraft,
  filterProjectIssues,
  getIssueStats,
  normalizeIssueDraft,
  type IssueDialogState,
} from "../model/projectIssues";

type UseProjectIssueControllerOptions = {
  currentUser: AuthUser;
  issues: ProjectIssue[];
  members: Member[];
  onCreateIssue: (issue: Partial<ProjectIssue>) => string;
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void;
  tasks: ScheduleTask[];
};

/** 課題一覧、詳細、編集ダイアログの遷移と更新を一つの操作境界にまとめます。 */
export function useProjectIssueController({
  currentUser,
  issues,
  members,
  onCreateIssue,
  onUpdateIssue,
  tasks,
}: UseProjectIssueControllerOptions) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectIssueStatus | "all">("all");
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<IssueDialogState | null>(null);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const filteredIssues = useMemo(
    () => filterProjectIssues({ issues, memberById, query, status: statusFilter, taskById }),
    [issues, memberById, query, statusFilter, taskById],
  );
  const stats = useMemo(() => getIssueStats(issues), [issues]);
  const detailIssue = detailIssueId
    ? (issues.find((issue) => issue.id === detailIssueId) ?? null)
    : null;

  const openCreateDialog = useCallback(() => {
    setDialog({ issue: createBlankIssueDraft(), mode: "create" });
    setStatusFilter("all");
  }, []);

  const openEditDialog = useCallback((issue: ProjectIssue) => {
    setDialog({ issue: cloneIssue(issue), mode: "edit" });
  }, []);

  const updateDialogIssue = useCallback((patch: Partial<ProjectIssue>) => {
    setDialog((current) =>
      current ? { ...current, issue: { ...current.issue, ...patch } } : current,
    );
  }, []);

  const saveDialogIssue = useCallback(() => {
    if (!dialog) {
      return;
    }
    const issue = normalizeIssueDraft(dialog.issue);
    if (dialog.mode === "create") {
      setDetailIssueId(onCreateIssue(issue));
    } else {
      onUpdateIssue(issue.id, issue);
    }
    setDialog(null);
  }, [dialog, onCreateIssue, onUpdateIssue]);

  const addIssueReply = useCallback(
    (issueId: string, body: string) => {
      const issue = issues.find((current) => current.id === issueId);
      if (!issue) {
        return;
      }
      const now = new Date().toISOString();
      const reply: ProjectIssueReply = {
        authorId: currentUser.id,
        authorName: currentUser.name,
        body: body.trim(),
        createdAt: now,
        id: `reply-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`,
      };
      onUpdateIssue(issueId, {
        replies: [...(issue.replies ?? []), reply],
        updatedAt: now,
      });
    },
    [currentUser.id, currentUser.name, issues, onUpdateIssue],
  );

  return {
    addIssueReply,
    closeDetail: () => setDetailIssueId(null),
    closeDialog: () => setDialog(null),
    detailIssue,
    dialog,
    filteredIssues,
    memberById,
    openCreateDialog,
    openDetail: setDetailIssueId,
    openEditDialog,
    query,
    saveDialogIssue,
    setQuery,
    setStatusFilter,
    stats,
    statusFilter,
    taskById,
    updateDialogIssue,
  };
}
