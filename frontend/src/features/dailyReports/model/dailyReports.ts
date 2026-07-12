import type {
  DailyReport,
  DailyReportEntry,
  CalendarDefinition,
  Member,
  Project,
  ScheduleTask,
  Team,
  WorkLogCategory,
} from "../../../types/schedule";
import { isDailyReportRequired } from "../utils/dailyReportSubmission";

type DailyReportUser = {
  memberId?: string | null;
  name: string;
  role: string;
};

export type DailyReportSchedule = {
  calendar: CalendarDefinition;
  members: Member[];
  project: Project;
  tasks: ScheduleTask[];
};

export function getTeamReportDateOptions(todayKey: string, reports: DailyReport[]) {
  return [...new Set([todayKey, ...reports.map((report) => report.date)])].toSorted().toReversed();
}

export function getTeamDailyReportDay(
  reports: DailyReport[],
  members: Member[],
  selectedDate: string,
  schedules: DailyReportSchedule[],
) {
  const reportsForDate = reports.filter((report) => report.date === selectedDate);
  const reportByMember = new Map(reportsForDate.map((report) => [report.memberId, report]));
  const requiredMemberIds = new Set(
    members
      .filter((member) => isDailyReportRequired(member, selectedDate, schedules))
      .map((member) => member.id),
  );
  return {
    blockerCount: reportsForDate.filter((report) => report.blockers?.trim()).length,
    missingMemberIds: members
      .filter((member) => requiredMemberIds.has(member.id) && !reportByMember.has(member.id))
      .map((member) => member.id),
    reportByMember,
    requiredMemberIds,
    requiredSubmitted: reportsForDate.filter(
      (report) => report.status === "submitted" && requiredMemberIds.has(report.memberId),
    ).length,
    totalHours: reportsForDate.reduce(
      (sum, report) => sum + sumDailyReportHours(report.entries),
      0,
    ),
  };
}

export function getDailyReportProjectName(projectId: string, schedules: DailyReportSchedule[]) {
  return (
    schedules.find((schedule) => schedule.project.id === projectId)?.project.workspace ?? projectId
  );
}

export function formatLongReportDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    month: "long",
    weekday: "short",
    year: "numeric",
  }).format(parsed);
}

export const categoryLabels: Record<WorkLogCategory, string> = {
  improvement: "改善",
  incident: "障害",
  maintenance: "保守",
  meeting: "会議",
  other: "その他",
  support: "問い合わせ",
};

export function collectScheduleMembers(schedules: DailyReportSchedule[]) {
  return [
    ...new Map(
      schedules.flatMap((schedule) => schedule.members).map((member) => [member.id, member]),
    ).values(),
  ];
}

export function findCurrentMember(members: Member[], currentUser: DailyReportUser) {
  return (
    members.find((member) => member.id === currentUser.memberId) ??
    members.find((member) => member.name === currentUser.name) ??
    members[0]
  );
}

export function canManageTeamReports(team: Team, currentUser: DailyReportUser) {
  return (
    currentUser.role === "admin" ||
    (team.memberships ?? []).some(
      (membership) => membership.memberId === currentUser.memberId && membership.role === "manager",
    )
  );
}

export function createDailyReportEntry(projectId: string): DailyReportEntry {
  return {
    category: "maintenance",
    hours: 1,
    id: `daily-entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    summary: "",
  };
}

export function createDailyReportDraft(
  memberId: string,
  date: string,
  projectId: string,
  now = new Date().toISOString(),
): DailyReport {
  return {
    comments: [],
    createdAt: now,
    date,
    entries: [createDailyReportEntry(projectId)],
    id: `daily-report-${memberId}-${date}-${Date.now()}`,
    memberId,
    status: "draft",
    summary: "",
    updatedAt: now,
    version: 0,
  };
}

export function sumDailyReportHours(entries: DailyReportEntry[]) {
  return entries.reduce((sum, entry) => sum + (Number.isFinite(entry.hours) ? entry.hours : 0), 0);
}

export function getDailyReportProjectActuals(
  entries: DailyReportEntry[],
  schedules: DailyReportSchedule[],
) {
  const totals = new Map<string, number>();
  const plans = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours);
    if (!entry.taskId) {
      continue;
    }
    const task = schedules
      .find((schedule) => schedule.project.id === entry.projectId)
      ?.tasks.find((candidate) => candidate.id === entry.taskId);
    if (task?.effortHours) {
      plans.set(entry.projectId, (plans.get(entry.projectId) ?? 0) + task.effortHours);
    }
  }
  return {
    exceeded: [...totals].some(
      ([projectId, hours]) => hours > (plans.get(projectId) ?? Number.POSITIVE_INFINITY),
    ),
    plans,
    totals,
  };
}

export function formatReportDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    month: "numeric",
    weekday: "short",
  }).format(parsed);
}
