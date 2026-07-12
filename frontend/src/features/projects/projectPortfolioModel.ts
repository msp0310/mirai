import type { ScheduleSnapshot } from "../../data/scheduleRepository";
import { isMemberActive } from "../../lib/members";
import {
  getProjectAssignedMembers,
  getProjectLifecycleStatus,
  projectLifecycleLabels,
} from "../../lib/projects";
import {
  getProgressStats,
  getTaskAssigneeAllocationPercent,
  getWorkingDays,
} from "../../lib/schedule";
import type { Member, Project, ScheduleTask, Team } from "../../types/schedule";
import type {
  ProjectPortfolioBuildInput,
  ProjectPortfolioItem,
  ProjectPortfolioSummaryBuildInput,
} from "./components/projectPortfolioTypes";

export type PortfolioFilter =
  | "all"
  | "attention"
  | "favorites"
  | "lowProgress"
  | ProjectPortfolioItem["lifecycleStatus"];
export type PortfolioSort = "priority" | "milestone" | "name" | "progressAsc" | "progressDesc";

export type TeamWorkloadItem = {
  delayedTaskCount: number;
  member: Member;
  openTaskCount: number;
  projectCount: number;
  remainingHours: number;
  topProject: Project | null;
};

/** 一覧・要対応パネル・集計カードで共有する案件注意判定です。 */
export function isAttentionProject(item: ProjectPortfolioItem) {
  return (
    item.lifecycleStatus !== "completed" && (item.delayedTasks.length > 0 || item.progress < 35)
  );
}

export function matchesPortfolioFilter(item: ProjectPortfolioItem, filter: PortfolioFilter) {
  if (filter === "attention") {
    return isAttentionProject(item);
  }
  if (filter === "favorites") {
    return item.favorite;
  }
  if (filter === "lowProgress") {
    return item.progress < 50;
  }
  if (filter === "planning" || filter === "inProgress" || filter === "completed") {
    return item.lifecycleStatus === filter;
  }
  return true;
}

export function matchesPortfolioQuery(item: ProjectPortfolioItem, query: string) {
  if (!query) {
    return true;
  }
  return [
    item.project.workspace,
    item.project.name,
    item.project.projectNo ?? "",
    item.team?.name ?? "",
    projectLifecycleLabels[item.lifecycleStatus],
    item.nextMilestone.title,
    ...item.assignedMembers.map((member) => member.name),
    ...item.delayedTasks.map((task) => task.title),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function comparePortfolioItems(
  a: ProjectPortfolioItem,
  b: ProjectPortfolioItem,
  sort: PortfolioSort,
) {
  if (sort === "milestone") {
    return (
      a.nextMilestone.start.localeCompare(b.nextMilestone.start) ||
      a.project.rangeEnd.localeCompare(b.project.rangeEnd)
    );
  }
  if (sort === "name") {
    return a.project.workspace.localeCompare(b.project.workspace, "ja");
  }
  if (sort === "progressAsc") {
    return a.progress - b.progress || a.nextMilestone.start.localeCompare(b.nextMilestone.start);
  }
  if (sort === "progressDesc") {
    return b.progress - a.progress || a.nextMilestone.start.localeCompare(b.nextMilestone.start);
  }
  return (
    getPortfolioPriority(b) - getPortfolioPriority(a) ||
    a.nextMilestone.start.localeCompare(b.nextMilestone.start) ||
    a.project.rangeEnd.localeCompare(b.project.rangeEnd)
  );
}

export function buildPortfolioItem({
  favorite,
  calendarAware,
  snapshot,
  team,
}: ProjectPortfolioBuildInput): ProjectPortfolioItem {
  const stats = getProgressStats(snapshot.tasks);
  const delayedTasks = snapshot.tasks
    .filter((task) => task.type === "task" && task.status === "delayed")
    .toSorted((a, b) => a.end.localeCompare(b.end));
  const nextMilestone =
    snapshot.tasks
      .filter((task) => task.type === "milestone" && task.status !== "done")
      .toSorted((a, b) => a.start.localeCompare(b.start))[0] ??
    ({
      start: snapshot.project.nextMilestone.date,
      status: "notStarted",
      title: snapshot.project.nextMilestone.title,
    } satisfies Pick<ScheduleTask, "start" | "status" | "title">);
  const activeTeamMemberIds = new Set(team?.memberIds);
  const assignedMembers = getProjectAssignedMembers({
    members: snapshot.members,
    project: snapshot.project,
    team,
  }).filter((member) => activeTeamMemberIds.has(member.id));

  return {
    assignedMembers,
    completedCount: stats.completed,
    delayedTasks,
    favorite,
    lifecycleStatus: getProjectLifecycleStatus(snapshot.project),
    memberCount: assignedMembers.length,
    nextMilestone,
    progress: stats.progress,
    project: snapshot.project,
    taskCount: stats.total,
    team,
    workDays: getWorkingDays(
      snapshot.project.rangeStart,
      snapshot.project.rangeEnd,
      snapshot.calendar,
      calendarAware,
    ),
  };
}

/** 詳細タスクをまだ取得していない案件を、API集計値だけでカード表示します。 */
export function buildPortfolioSummaryItem({
  favorite,
  summary,
  team,
}: ProjectPortfolioSummaryBuildInput): ProjectPortfolioItem {
  return {
    assignedMembers: [],
    completedCount: summary.completedTaskCount,
    delayedTasks: Array.from(
      { length: summary.delayedTaskCount },
      (_, index) =>
        ({
          assigneeIds: [],
          color: "#f59e0b",
          end: summary.project.rangeEnd,
          id: `${summary.project.id}-delayed-${index}`,
          parentId: null,
          progress: summary.progress,
          start: summary.project.rangeEnd,
          status: "delayed",
          title: "遅延タスク",
          type: "task",
        }) satisfies ScheduleTask,
    ),
    favorite,
    lifecycleStatus: getProjectLifecycleStatus(summary.project),
    memberCount: summary.memberCount,
    nextMilestone: {
      start: summary.project.nextMilestone.date,
      status: "notStarted",
      title: summary.project.nextMilestone.title,
    },
    progress: summary.progress,
    project: summary.project,
    taskCount: summary.taskCount,
    team,
    workDays: null,
  };
}

export function buildTeamWorkloads({
  calendarAware,
  schedules,
  team,
}: {
  calendarAware: boolean;
  schedules: ScheduleSnapshot[];
  team: Team | undefined;
}): TeamWorkloadItem[] {
  const teamMemberIds = new Set(team?.memberIds);
  const workloads = new Map<
    string,
    TeamWorkloadItem & {
      projectHours: Map<string, number>;
      projectRefs: Map<string, Project>;
    }
  >();

  schedules.forEach((snapshot) => {
    snapshot.members
      .filter((member) => isMemberActive(member) && teamMemberIds.has(member.id))
      .forEach((member) => {
        if (!workloads.has(member.id)) {
          workloads.set(member.id, {
            delayedTaskCount: 0,
            member,
            openTaskCount: 0,
            projectCount: 0,
            projectHours: new Map(),
            projectRefs: new Map(),
            remainingHours: 0,
            topProject: null,
          });
        }
      });

    snapshot.tasks
      .filter((task) => task.type === "task" && task.status !== "done")
      .forEach((task) => {
        const workingHours =
          task.effortHours ??
          getWorkingDays(task.start, task.end, snapshot.calendar, calendarAware) * 8;
        task.assigneeIds.forEach((memberId) => {
          if (!teamMemberIds.has(memberId)) {
            return;
          }
          const workload = workloads.get(memberId);
          if (!workload) {
            return;
          }
          const allocation = getTaskAssigneeAllocationPercent(task, memberId) / 100;
          const memberHours = workingHours * allocation * (1 - task.progress / 100);
          if (memberHours <= 0) {
            return;
          }
          workload.remainingHours += memberHours;
          workload.openTaskCount += 1;
          if (task.status === "delayed") {
            workload.delayedTaskCount += 1;
          }
          workload.projectRefs.set(snapshot.project.id, snapshot.project);
          workload.projectHours.set(
            snapshot.project.id,
            (workload.projectHours.get(snapshot.project.id) ?? 0) + memberHours,
          );
        });
      });
  });

  return [...workloads.values()]
    .map((item) => {
      const topProjectId = [...item.projectHours.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0];
      const { projectRefs, ...workload } = item;
      return {
        ...workload,
        projectCount: projectRefs.size,
        remainingHours: Math.round(item.remainingHours),
        topProject: topProjectId ? (projectRefs.get(topProjectId) ?? null) : null,
      };
    })
    .filter((item) => item.remainingHours > 0)
    .toSorted(
      (a, b) =>
        b.delayedTaskCount - a.delayedTaskCount ||
        b.remainingHours - a.remainingHours ||
        a.member.name.localeCompare(b.member.name, "ja"),
    );
}

function getPortfolioPriority(item: ProjectPortfolioItem) {
  return (
    Number(item.favorite) * 1000 +
    Math.min(item.delayedTasks.length, 8) * 100 +
    (item.progress < 35 ? 60 : 0) +
    Math.max(60 - item.progress, 0)
  );
}
