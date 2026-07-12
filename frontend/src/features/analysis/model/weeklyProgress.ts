import { addDays, parseDate, toDateKey } from "../../../lib/schedule";
import type {
  Member,
  ProjectIssue,
  ProjectIssuePriority,
  ProjectIssueStatus,
  ScheduleTask,
} from "../../../types/schedule";

export const maxWeeklyDetailTasks = 80;
export const maxVisibleWeeklyIssues = 40;
export const visibleWeekCount = 3;

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

export type WeeklyProgressRow = {
  completed: number;
  currentProgress: number;
  delayed: number;
  end: string;
  inProgress: number;
  planned: number;
  start: string;
  targetCount: number;
  weekKey: string;
};

export type WeeklyTaskGroup = {
  member: Member | null;
  memberId: string;
  tasks: ScheduleTask[];
};

export type WeeklyProgressMetrics = {
  actualCompletionRate: number;
  completionGap: number;
  delayedCount: number;
  plannedCompletionCount: number;
  totalCompleted: number;
  totalIncomplete: number;
  totalTasks: number;
};

export type WeeklyTaskDetail = {
  groups: WeeklyTaskGroup[];
  hiddenCount: number;
  totalCount: number;
};

const unassignedMemberId = "__unassigned__";

/** 案件期間を週単位に区切り、現在のタスク状態を集計します。 */
export function buildWeeklyProgressRows(
  tasks: ScheduleTask[],
  projectStart: string,
  projectEnd: string,
): WeeklyProgressRow[] {
  const rows = createWeekRows(projectStart, projectEnd);
  const rowsByWeek = new Map(rows.map((row) => [row.weekKey, row]));
  const actionableTasks = tasks.filter((task) => task.type === "task");

  actionableTasks.forEach((task) => {
    const endWeek = getWeekStartKey(clampDate(task.end, projectStart, projectEnd));
    const dueRow = rowsByWeek.get(endWeek);
    if (dueRow) {
      dueRow.planned += 1;
      dueRow.completed += task.status === "done" ? 1 : 0;
      dueRow.delayed += task.status === "delayed" ? 1 : 0;
    }

    rows.forEach((row) => {
      if (task.start > row.end || task.end < row.start) {
        return;
      }
      if (task.status === "inProgress") {
        row.inProgress += 1;
      }
      row.currentProgress += task.progress;
      row.targetCount += 1;
    });
  });

  return rows.map((row) => ({
    ...row,
    currentProgress: row.targetCount > 0 ? Math.round(row.currentProgress / row.targetCount) : 0,
  }));
}

/** 選択週までに期限を迎える課題を、未解消と優先度を考慮して並べます。 */
export function getIssuesDueByWeek(issues: ProjectIssue[], weekEnd: string) {
  return issues
    .filter((issue) => issue.dueDate && issue.dueDate <= weekEnd)
    .toSorted((left, right) => {
      const leftResolved = isIssueResolved(left);
      const rightResolved = isIssueResolved(right);
      if (leftResolved !== rightResolved) {
        return leftResolved ? 1 : -1;
      }
      return (
        (left.dueDate ?? "").localeCompare(right.dueDate ?? "") ||
        getIssuePriorityOrder(left.priority) - getIssuePriorityOrder(right.priority)
      );
    });
}

export function getWeeklyProgressMetrics(
  actionableTasks: ScheduleTask[],
  rows: WeeklyProgressRow[],
  currentWeek: WeeklyProgressRow | undefined,
): WeeklyProgressMetrics {
  const totalCompleted = actionableTasks.filter((task) => task.status === "done").length;
  const plannedCompletionCount = currentWeek
    ? rows
        .filter((row) => row.weekKey <= currentWeek.weekKey)
        .reduce((sum, row) => sum + row.planned, 0)
    : 0;
  const actualCompletionRate =
    actionableTasks.length > 0 ? Math.round((totalCompleted / actionableTasks.length) * 100) : 0;
  const plannedCompletionRate =
    actionableTasks.length > 0
      ? Math.round((plannedCompletionCount / actionableTasks.length) * 100)
      : 0;

  return {
    actualCompletionRate,
    completionGap: actualCompletionRate - plannedCompletionRate,
    delayedCount: actionableTasks.filter((task) => task.status === "delayed").length,
    plannedCompletionCount,
    totalCompleted,
    totalIncomplete: actionableTasks.length - totalCompleted,
    totalTasks: actionableTasks.length,
  };
}

export function findCurrentWeek(rows: WeeklyProgressRow[], todayKey: string, projectStart: string) {
  const matched = rows.find((row) => row.start <= todayKey && todayKey <= row.end);
  if (matched) {
    return matched;
  }
  return todayKey < projectStart ? rows[0] : rows[rows.length - 1];
}

export function buildWeeklyTaskDetail(
  week: WeeklyProgressRow | undefined,
  tasks: ScheduleTask[],
  members: Member[],
): WeeklyTaskDetail {
  if (!week) {
    return { groups: [], hiddenCount: 0, totalCount: 0 };
  }
  const groups = buildWeeklyTaskGroups(week, tasks, members);
  const totalCount = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id))).size;
  let remaining = maxWeeklyDetailTasks;
  const visibleGroups = groups
    .map((group) => {
      const visibleTasks = group.tasks.slice(0, Math.min(group.tasks.length, remaining));
      remaining -= visibleTasks.length;
      return { ...group, tasks: visibleTasks };
    })
    .filter((group) => group.tasks.length > 0);

  return {
    groups: visibleGroups,
    hiddenCount: Math.max(totalCount - (maxWeeklyDetailTasks - remaining), 0),
    totalCount,
  };
}

export function isIssueResolved(issue: ProjectIssue) {
  return issue.status === "resolved" || issue.status === "closed";
}

export function formatIssueAssignees(issue: ProjectIssue, memberById: Map<string, Member>) {
  if (issue.assigneeIds.length === 0) {
    return "担当未設定";
  }
  return issue.assigneeIds
    .map((memberId) => memberById.get(memberId)?.name ?? "不明な担当者")
    .join(" / ");
}

export function formatWeekLabel(start: string) {
  return `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))}週`;
}

export function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createWeekRows(projectStart: string, projectEnd: string): WeeklyProgressRow[] {
  const rows: WeeklyProgressRow[] = [];
  let cursor = parseDate(getWeekStartKey(projectStart));
  const rangeEnd = parseDate(projectEnd);

  while (cursor <= rangeEnd) {
    const weekStart = toDateKey(cursor);
    const weekEnd = toDateKey(addDays(cursor, 6));
    rows.push({
      completed: 0,
      currentProgress: 0,
      delayed: 0,
      end: weekEnd < projectEnd ? weekEnd : projectEnd,
      inProgress: 0,
      planned: 0,
      start: weekStart > projectStart ? weekStart : projectStart,
      targetCount: 0,
      weekKey: weekStart,
    });
    cursor = addDays(cursor, 7);
  }
  return rows;
}

function getWeekStartKey(value: string) {
  const date = parseDate(value);
  const day = date.getDay();
  return toDateKey(addDays(date, day === 0 ? -6 : 1 - day));
}

function clampDate(value: string, start: string, end: string) {
  return value < start ? start : value > end ? end : value;
}

function buildWeeklyTaskGroups(
  week: WeeklyProgressRow,
  tasks: ScheduleTask[],
  members: Member[],
): WeeklyTaskGroup[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const groups = new Map<string, WeeklyTaskGroup>();
  tasks
    .filter((task) => task.start <= week.end && task.end >= week.start)
    .toSorted((left, right) => {
      const leftPriority = left.status === "delayed" ? 0 : left.status === "inProgress" ? 1 : 2;
      const rightPriority = right.status === "delayed" ? 0 : right.status === "inProgress" ? 1 : 2;
      return (
        leftPriority - rightPriority ||
        left.start.localeCompare(right.start) ||
        left.title.localeCompare(right.title)
      );
    })
    .forEach((task) => {
      const assigneeIds = task.assigneeIds.length > 0 ? task.assigneeIds : [unassignedMemberId];
      assigneeIds.forEach((memberId) => {
        const group = groups.get(memberId) ?? {
          member: memberById.get(memberId) ?? null,
          memberId,
          tasks: [],
        };
        group.tasks.push(task);
        groups.set(memberId, group);
      });
    });

  return [...groups.values()].toSorted((left, right) => {
    if (left.memberId === unassignedMemberId) {
      return -1;
    }
    if (right.memberId === unassignedMemberId) {
      return 1;
    }
    return (left.member?.name ?? "").localeCompare(right.member?.name ?? "");
  });
}

function getIssuePriorityOrder(priority: ProjectIssuePriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}
