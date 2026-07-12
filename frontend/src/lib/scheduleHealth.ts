import type {
  CalendarDefinition,
  Member,
  Project,
  ResourceRowModel,
  ScheduleTask,
} from "../types/schedule";
import { isWorkingDay, parseDate } from "./schedule";

export type ScheduleHealthSeverity = "danger" | "warning" | "info";

export type ScheduleHealthIssue = {
  category: "assign" | "calendar" | "dependency" | "hierarchy" | "load" | "schedule";
  detail: string;
  id: string;
  severity: ScheduleHealthSeverity;
  taskId?: string;
  title: string;
};

export type ScheduleHealthReport = {
  dangerCount: number;
  issues: ScheduleHealthIssue[];
  score: number;
  statusLabel: string;
  warningCount: number;
};

type ScheduleHealthInput = {
  calendar: CalendarDefinition;
  calendarAware?: boolean;
  members: Member[];
  project: Project;
  resourceRows: ResourceRowModel[];
  tasks: ScheduleTask[];
};

/** buildScheduleHealthReportを実行し、アプリケーション用の値を返します。 */
export function buildScheduleHealthReport({
  calendar,
  calendarAware = true,
  members,
  project,
  resourceRows,
  tasks,
}: ScheduleHealthInput): ScheduleHealthReport {
  const issues: ScheduleHealthIssue[] = [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const memberIds = new Set(members.map((member) => member.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rootTasks = tasks.filter((task) => task.parentId === null);

  pushDuplicates(
    issues,
    tasks.map((task) => task.id),
    "タスクIDが重複しています",
    "重複IDは保存やAPI連携時にタスクを特定できなくします。",
    "hierarchy",
  );
  pushDuplicates(
    issues,
    members.map((member) => member.id),
    "メンバーIDが重複しています",
    "担当者の集計と保存時の紐付けが不安定になります。",
    "assign",
  );

  if (rootTasks.length === 0) {
    issues.push({
      category: "hierarchy",
      detail: "全体を表すルート行がありません。",
      id: "root-missing",
      severity: "danger",
      title: "ルートタスクがありません",
    });
  } else if (rootTasks.length > 1) {
    issues.push({
      category: "hierarchy",
      detail: `${rootTasks.length}件のルート行があります。階層の起点を確認してください。`,
      id: "root-many",
      severity: "warning",
      title: "ルートタスクが複数あります",
    });
  }

  if (calendar.workWeek.length === 0) {
    issues.push({
      category: "calendar",
      detail: "稼働曜日が未設定のため、工数と終了日計算が成立しません。",
      id: "calendar-empty-work-week",
      severity: "danger",
      title: "稼働曜日がありません",
    });
  }
  if (new Set(calendar.workWeek).size !== calendar.workWeek.length) {
    issues.push({
      category: "calendar",
      detail: "同じ曜日が複数回設定されています。",
      id: "calendar-duplicate-work-week",
      severity: "warning",
      title: "稼働曜日が重複しています",
    });
  }

  tasks.forEach((task) => {
    if (!isDateKey(task.start) || !isDateKey(task.end)) {
      issues.push({
        category: "schedule",
        detail: `${task.start} - ${task.end}`,
        id: `${task.id}-invalid-date`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の日付が実在しません`,
      });
      return;
    }

    if (task.end < task.start) {
      issues.push({
        category: "schedule",
        detail: `${task.start} - ${task.end}`,
        id: `${task.id}-date-order`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の終了日が開始日より前です`,
      });
    }

    if (
      calendarAware &&
      task.type !== "summary" &&
      task.type !== "phase" &&
      !isWorkingDay(parseDate(task.start), calendar, true)
    ) {
      issues.push({
        category: "calendar",
        detail: `${task.start} は非稼働日です。開始日を稼働日に寄せてください。`,
        id: `${task.id}-start-non-working`,
        severity: "warning",
        taskId: task.id,
        title: `${task.title} の開始日が非稼働日です`,
      });
    }

    if (
      calendarAware &&
      task.type !== "summary" &&
      task.type !== "phase" &&
      task.end !== task.start &&
      !isWorkingDay(parseDate(task.end), calendar, true)
    ) {
      issues.push({
        category: "calendar",
        detail: `${task.end} は非稼働日です。終了日を稼働日に寄せてください。`,
        id: `${task.id}-end-non-working`,
        severity: "warning",
        taskId: task.id,
        title: `${task.title} の終了日が非稼働日です`,
      });
    }

    if (task.start < project.rangeStart || task.end > project.rangeEnd) {
      issues.push({
        category: "schedule",
        detail: `${task.start} - ${task.end} / プロジェクト ${project.rangeStart} - ${project.rangeEnd}`,
        id: `${task.id}-outside-range`,
        severity: "warning",
        taskId: task.id,
        title: `${task.title} が当初計画期間を超過しています`,
      });
    }

    if (task.type === "milestone" && task.start !== task.end) {
      issues.push({
        category: "schedule",
        detail: `${task.start} - ${task.end}`,
        id: `${task.id}-milestone-range`,
        severity: "warning",
        taskId: task.id,
        title: `${task.title} の開始日と終了日が異なります`,
      });
    }

    if (task.parentId === task.id) {
      issues.push({
        category: "hierarchy",
        detail: "親IDが自分自身になっています。",
        id: `${task.id}-self-parent`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の階層が循環しています`,
      });
    } else if (task.parentId !== null && !taskIds.has(task.parentId)) {
      issues.push({
        category: "hierarchy",
        detail: `親ID: ${task.parentId}`,
        id: `${task.id}-missing-parent`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の親タスクが見つかりません`,
      });
    }

    const parent = task.parentId ? taskById.get(task.parentId) : null;
    if (parent && parent.type !== "summary" && parent.type !== "phase") {
      issues.push({
        category: "hierarchy",
        detail: `${parent.title} は ${parent.type} です。`,
        id: `${task.id}-invalid-parent-type`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の親タスク種別を確認してください`,
      });
    }

    if (task.type !== "summary" && task.assigneeIds.length === 0) {
      issues.push({
        category: "assign",
        detail: "担当者未設定のため、負荷集計と担当確認に出ません。",
        id: `${task.id}-empty-assignee`,
        severity: "warning",
        taskId: task.id,
        title: `${task.title} に担当者がいません`,
      });
    }

    task.assigneeIds.forEach((assigneeId) => {
      if (!memberIds.has(assigneeId)) {
        issues.push({
          category: "assign",
          detail: `担当者ID: ${assigneeId}`,
          id: `${task.id}-unknown-assignee-${assigneeId}`,
          severity: "danger",
          taskId: task.id,
          title: `${task.title} の担当者が見つかりません`,
        });
      }
    });

    (task.dependencies ?? []).forEach((dependencyId) => {
      const dependency = taskById.get(dependencyId);
      if (dependencyId === task.id) {
        issues.push({
          category: "dependency",
          detail: "自分自身を前提タスクにしています。",
          id: `${task.id}-self-dependency`,
          severity: "danger",
          taskId: task.id,
          title: `${task.title} の依存関係が循環しています`,
        });
        return;
      }
      if (!dependency) {
        issues.push({
          category: "dependency",
          detail: `依存ID: ${dependencyId}`,
          id: `${task.id}-missing-dependency-${dependencyId}`,
          severity: "danger",
          taskId: task.id,
          title: `${task.title} の前提タスクが見つかりません`,
        });
        return;
      }
      if (dependency.status !== "done") {
        issues.push({
          category: "dependency",
          detail: `${dependency.title} が未完了です。`,
          id: `${task.id}-incomplete-dependency-${dependencyId}`,
          severity: "warning",
          taskId: task.id,
          title: `${task.title} の前提が未完了です`,
        });
      }
      if (dependency.end >= task.start) {
        issues.push({
          category: "dependency",
          detail: `${dependency.title} (${dependency.end}) → ${task.title} (${task.start})`,
          id: `${task.id}-date-dependency-${dependencyId}`,
          severity: "warning",
          taskId: task.id,
          title: `${task.title} の依存日付を確認してください`,
        });
      }
    });
  });

  findCycles(tasks, (task) => (task.parentId ? [task.parentId] : [])).forEach(
    (task) => {
      issues.push({
        category: "hierarchy",
        detail: "親子階層が循環しています。",
        id: `${task.id}-parent-cycle`,
        severity: "danger",
        taskId: task.id,
        title: `${task.title} の階層が循環しています`,
      });
    },
  );

  findCycles(tasks, (task) => task.dependencies ?? []).forEach((task) => {
    issues.push({
      category: "dependency",
      detail: "依存関係が循環しています。",
      id: `${task.id}-dependency-cycle`,
      severity: "danger",
      taskId: task.id,
      title: `${task.title} の依存関係が循環しています`,
    });
  });

  resourceRows
    .filter((row) => row.utilization >= 90)
    .forEach((row) => {
      issues.push({
        category: "load",
        detail: `${row.member.name} の平均負荷が ${row.utilization}% です。`,
        id: `load-${row.member.id}`,
        severity: "warning",
        title: "高負荷メンバーがいます",
      });
    });

  const uniqueIssues = uniqueById(issues).sort(compareIssues);
  const dangerCount = uniqueIssues.filter((issue) => issue.severity === "danger").length;
  const warningCount = uniqueIssues.filter((issue) => issue.severity === "warning").length;
  const dangerPenalty = Math.min(dangerCount * 18, 100);
  const warningPenalty = Math.min(warningCount * 3, 55);
  const score = Math.max(0, 100 - dangerPenalty - warningPenalty);
  const statusLabel =
    dangerCount > 0 ? "要修正" : warningCount > 0 ? "要確認" : "健全";

  return {
    dangerCount,
    issues: uniqueIssues,
    score,
    statusLabel,
    warningCount,
  };
}

function compareIssues(a: ScheduleHealthIssue, b: ScheduleHealthIssue) {
  const severityRank: Record<ScheduleHealthSeverity, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  };
  return severityRank[a.severity] - severityRank[b.severity];
}

function findCycles(
  tasks: ScheduleTask[],
  getNextIds: (task: ScheduleTask) => string[],
) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cyclicTasks = new Map<string, ScheduleTask>();

  function visit(task: ScheduleTask) {
    if (visiting.has(task.id)) {
      cyclicTasks.set(task.id, task);
      return;
    }
    if (visited.has(task.id)) return;

    visiting.add(task.id);
    getNextIds(task).forEach((nextId) => {
      const nextTask = taskById.get(nextId);
      if (nextTask) visit(nextTask);
    });
    visiting.delete(task.id);
    visited.add(task.id);
  }

  tasks.forEach(visit);
  return [...cyclicTasks.values()];
}

function isDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function pushDuplicates(
  issues: ScheduleHealthIssue[],
  values: string[],
  title: string,
  detail: string,
  category: ScheduleHealthIssue["category"],
) {
  getDuplicates(values).forEach((value) => {
    issues.push({
      category,
      detail: `${detail} 重複ID: ${value}`,
      id: `${category}-duplicate-${value}`,
      severity: "danger",
      title,
    });
  });
}

function getDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function uniqueById(issues: ScheduleHealthIssue[]) {
  const byId = new Map<string, ScheduleHealthIssue>();
  issues.forEach((issue) => byId.set(issue.id, issue));
  return [...byId.values()];
}
