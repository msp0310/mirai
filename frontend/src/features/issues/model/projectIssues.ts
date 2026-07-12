import type {
  Member,
  ProjectIssue,
  ProjectIssuePriority,
  ProjectIssueStatus,
  ProjectIssueType,
  ScheduleTask,
} from "../../../types/schedule";

export const issueStatusLabels: Record<ProjectIssueStatus, string> = {
  blocked: "ブロック",
  closed: "クローズ",
  inProgress: "対応中",
  open: "未対応",
  resolved: "解決",
};

export const issuePriorityLabels: Record<ProjectIssuePriority, string> = {
  critical: "緊急",
  high: "高",
  low: "低",
  medium: "中",
};

export const issueTypeLabels: Record<ProjectIssueType, string> = {
  bug: "不具合",
  change: "変更",
  question: "確認",
  risk: "リスク",
  task: "作業",
};

export const issueStatusOptions = Object.keys(issueStatusLabels) as ProjectIssueStatus[];
export const issuePriorityOptions = Object.keys(issuePriorityLabels) as ProjectIssuePriority[];
export const issueTypeOptions = Object.keys(issueTypeLabels) as ProjectIssueType[];

export type IssueDialogState = {
  issue: ProjectIssue;
  mode: "create" | "edit";
};

export function filterProjectIssues({
  issues,
  memberById,
  query,
  status,
  taskById,
}: {
  issues: ProjectIssue[];
  memberById: Map<string, Member>;
  query: string;
  status: ProjectIssueStatus | "all";
  taskById: Map<string, ScheduleTask>;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  return issues.filter((issue) => {
    if (status !== "all" && issue.status !== status) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const assigneeNames = issue.assigneeIds
      .map((memberId) => memberById.get(memberId)?.name ?? memberId)
      .join(" ");
    const taskNames = issue.taskIds
      .map((taskId) => taskById.get(taskId)?.title ?? taskId)
      .join(" ");
    const replyText = (issue.replies ?? [])
      .map((reply) => `${reply.authorName} ${reply.body}`)
      .join(" ");
    return `${issue.title} ${issue.body} ${replyText} ${assigneeNames} ${taskNames}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function getIssueStats(issues: ProjectIssue[]) {
  const openIssues = issues.filter(
    (issue) => issue.status !== "closed" && issue.status !== "resolved",
  );
  return {
    blocked: openIssues.filter((issue) => issue.status === "blocked").length,
    critical: openIssues.filter(
      (issue) => issue.priority === "critical" || issue.priority === "high",
    ).length,
    due: openIssues.filter((issue) => issue.dueDate).length,
    open: openIssues.length,
  };
}

export function formatAssignees(ids: string[], memberById: Map<string, Member>) {
  if (ids.length === 0) {
    return "未設定";
  }
  return ids.map((id) => memberById.get(id)?.initials ?? id).join(" / ");
}

export function formatDueDate(dueDate: string | undefined) {
  if (!dueDate) {
    return "未設定";
  }
  const [, month, day] = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!month || !day) {
    return dueDate;
  }
  return `${Number(month)}/${Number(day)}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function getInitialLetters(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "--";
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function createBlankIssueDraft(now = new Date().toISOString()): ProjectIssue {
  return {
    assigneeIds: [],
    body: "",
    createdAt: now,
    github: { syncStatus: "unlinked" },
    id: "issue-draft",
    priority: "medium",
    replies: [],
    status: "open",
    taskIds: [],
    title: "",
    type: "task",
    updatedAt: now,
  };
}

export function cloneIssue(issue: ProjectIssue): ProjectIssue {
  return {
    ...issue,
    assigneeIds: [...issue.assigneeIds],
    github: issue.github ? { ...issue.github } : { syncStatus: "unlinked" },
    replies: [...(issue.replies ?? [])],
    taskIds: [...issue.taskIds],
  };
}

export function normalizeIssueDraft(issue: ProjectIssue): ProjectIssue {
  return {
    ...issue,
    assigneeIds: [...issue.assigneeIds],
    body: issue.body.trim(),
    dueDate: issue.dueDate || undefined,
    github: issue.github ?? { syncStatus: "unlinked" },
    replies: [...(issue.replies ?? [])],
    taskIds: [...issue.taskIds],
    title: issue.title.trim() || "新しい課題",
  };
}
