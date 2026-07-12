import type { ScheduleWorkspace } from "../data/scheduleRepository";
import type {
  Member,
  Project,
  ScheduleTask,
  TaskInspectorFocusTarget,
  Team,
} from "../types/schedule";
import { getProjectLifecycleStatus, projectLifecycleLabels } from "./projects";
import { getTaskAssigneeAllocationMap, statusLabels } from "./schedule";

export type TaskChangeKind = "added" | "removed" | "updated";

export type TaskFieldChange = {
  after: string;
  before: string;
  focusTarget?: TaskInspectorFocusTarget;
  label: string;
};

export type TaskChangeRow = {
  assigneeLabel: string;
  changeCount: number;
  fields: TaskFieldChange[];
  id: string;
  kind: TaskChangeKind;
  projectId?: string;
  projectLabel?: string;
  taskId: string;
  title: string;
};

export type TaskChangeReview = {
  addedCount: number;
  fieldChangeCount: number;
  removedCount: number;
  rows: TaskChangeRow[];
  totalCount: number;
  updatedCount: number;
};

export type ConfigChangeCategory = "calendar" | "member" | "project" | "team";

export type ConfigChangeRow = {
  category: ConfigChangeCategory;
  detail: string;
  fields: TaskFieldChange[];
  id: string;
  projectId?: string;
  projectLabel?: string;
  title: string;
};

export type ConfigChangeReview = {
  calendarCount: number;
  fieldChangeCount: number;
  memberCount: number;
  projectCount: number;
  rows: ConfigChangeRow[];
  teamCount: number;
  totalCount: number;
};

type BuildTaskChangeReviewInput = {
  currentTasks: ScheduleTask[];
  members: Member[];
  projectId?: string;
  projectLabel?: string;
  savedTasks: ScheduleTask[];
};

type ReviewSchedule = {
  members: Member[];
  project: Pick<Project, "id" | "workspace">;
  tasks: ScheduleTask[];
};

type BuildWorkspaceTaskChangeReviewInput = {
  currentSchedules: ReviewSchedule[];
  savedSchedules: ReviewSchedule[];
};

const taskTypeLabels: Record<ScheduleTask["type"], string> = {
  milestone: "マイルストーン",
  phase: "フェーズ",
  summary: "サマリー",
  task: "タスク",
};
export function buildTaskChangeReview({
  currentTasks,
  members,
  projectId,
  projectLabel,
  savedTasks,
}: BuildTaskChangeReviewInput): TaskChangeReview {
  const currentById = new Map(currentTasks.map((task) => [task.id, task]));
  const savedById = new Map(savedTasks.map((task) => [task.id, task]));
  const allIds = new Set([...savedById.keys(), ...currentById.keys()]);
  const rows: TaskChangeRow[] = [];
  const rowIdPrefix = projectId ? `${projectId}:` : "";
  const projectMeta = { projectId, projectLabel };

  allIds.forEach((taskId) => {
    const before = savedById.get(taskId);
    const after = currentById.get(taskId);
    if (!before && after) {
      rows.push({
        assigneeLabel: formatAssignees(after.assigneeIds, members),
        changeCount: 1,
        fields: [
          {
            after: `${after.start} - ${after.end}`,
            before: "-",
            focusTarget: "start",
            label: "期間",
          },
        ],
        id: `${rowIdPrefix}added-${taskId}`,
        kind: "added",
        ...projectMeta,
        taskId,
        title: after.title,
      });
      return;
    }

    if (before && !after) {
      rows.push({
        assigneeLabel: formatAssignees(before.assigneeIds, members),
        changeCount: 1,
        fields: [
          {
            after: "-",
            before: `${before.start} - ${before.end}`,
            focusTarget: "start",
            label: "期間",
          },
        ],
        id: `${rowIdPrefix}removed-${taskId}`,
        kind: "removed",
        ...projectMeta,
        taskId,
        title: before.title,
      });
      return;
    }

    if (!before || !after) {
      return;
    }

    const fields = getTaskFieldChanges(before, after, currentTasks, savedTasks, members);
    if (fields.length === 0) {
      return;
    }
    rows.push({
      assigneeLabel: formatAssignees(after.assigneeIds, members),
      changeCount: fields.length,
      fields,
      id: `${rowIdPrefix}updated-${taskId}`,
      kind: "updated",
      ...projectMeta,
      taskId,
      title: after.title,
    });
  });

  return summarizeTaskChangeRows(rows);
}
export function buildWorkspaceTaskChangeReview({
  currentSchedules,
  savedSchedules,
}: BuildWorkspaceTaskChangeReviewInput): TaskChangeReview {
  const currentByProjectId = new Map(
    currentSchedules.map((schedule) => [schedule.project.id, schedule]),
  );
  const savedByProjectId = new Map(
    savedSchedules.map((schedule) => [schedule.project.id, schedule]),
  );
  const rows: TaskChangeRow[] = [];

  currentSchedules.forEach((currentSchedule) => {
    const savedSchedule = savedByProjectId.get(currentSchedule.project.id);
    rows.push(
      ...buildTaskChangeReview({
        currentTasks: currentSchedule.tasks,
        members: currentSchedule.members,
        projectId: currentSchedule.project.id,
        projectLabel: currentSchedule.project.workspace,
        savedTasks: savedSchedule?.tasks ?? [],
      }).rows,
    );
  });

  savedSchedules.forEach((savedSchedule) => {
    if (currentByProjectId.has(savedSchedule.project.id)) {
      return;
    }
    rows.push(
      ...buildTaskChangeReview({
        currentTasks: [],
        members: savedSchedule.members,
        projectId: savedSchedule.project.id,
        projectLabel: savedSchedule.project.workspace,
        savedTasks: savedSchedule.tasks,
      }).rows,
    );
  });

  return summarizeTaskChangeRows(rows);
}
export function buildWorkspaceConfigChangeReview({
  currentWorkspace,
  savedWorkspace,
}: {
  currentWorkspace: ScheduleWorkspace;
  savedWorkspace: ScheduleWorkspace;
}): ConfigChangeReview {
  const rows: ConfigChangeRow[] = [];
  const currentMembersById = getWorkspaceMemberNameMap(currentWorkspace);
  const savedMembersById = getWorkspaceMemberNameMap(savedWorkspace);
  const currentByProjectId = new Map(
    currentWorkspace.schedules.map((schedule) => [schedule.project.id, schedule]),
  );
  const savedByProjectId = new Map(
    savedWorkspace.schedules.map((schedule) => [schedule.project.id, schedule]),
  );
  const allProjectIds = new Set([...currentByProjectId.keys(), ...savedByProjectId.keys()]);

  allProjectIds.forEach((projectId) => {
    const currentSchedule = currentByProjectId.get(projectId);
    const savedSchedule = savedByProjectId.get(projectId);
    const projectLabel =
      currentSchedule?.project.workspace ?? savedSchedule?.project.workspace ?? projectId;

    if (!savedSchedule && currentSchedule) {
      rows.push({
        category: "project",
        detail: "新しいプロジェクト",
        fields: [
          {
            after: currentSchedule.project.rangeStart,
            before: "-",
            label: "開始日",
          },
          {
            after: currentSchedule.project.rangeEnd,
            before: "-",
            label: "終了日",
          },
        ],
        id: `project-added-${projectId}`,
        projectId,
        projectLabel,
        title: currentSchedule.project.workspace,
      });
      return;
    }

    if (savedSchedule && !currentSchedule) {
      rows.push({
        category: "project",
        detail: "プロジェクトを削除",
        fields: [
          {
            after: "-",
            before: savedSchedule.project.rangeStart,
            label: "開始日",
          },
          {
            after: "-",
            before: savedSchedule.project.rangeEnd,
            label: "終了日",
          },
        ],
        id: `project-removed-${projectId}`,
        projectId,
        projectLabel,
        title: savedSchedule.project.workspace,
      });
      return;
    }

    if (!currentSchedule || !savedSchedule) {
      return;
    }

    const projectFields = getProjectFieldChanges(
      savedSchedule.project,
      currentSchedule.project,
      savedWorkspace.teams,
      currentWorkspace.teams,
      savedMembersById,
      currentMembersById,
    );
    if (projectFields.length > 0) {
      rows.push({
        category: "project",
        detail: `${projectFields.length}項目を変更`,
        fields: projectFields,
        id: `project-updated-${projectId}`,
        projectId,
        projectLabel,
        title: currentSchedule.project.workspace,
      });
    }

    const calendarFields = getCalendarFieldChanges(
      savedSchedule.calendar,
      currentSchedule.calendar,
    );
    if (calendarFields.length > 0) {
      rows.push({
        category: "calendar",
        detail: `${calendarFields.length}項目を変更`,
        fields: calendarFields,
        id: `calendar-updated-${projectId}`,
        projectId,
        projectLabel,
        title: `${currentSchedule.project.workspace} のカレンダー`,
      });
    }

    const memberFields = getMemberDirectoryFieldChanges(
      savedSchedule.members,
      currentSchedule.members,
    );
    if (memberFields.length > 0) {
      rows.push({
        category: "member",
        detail: `${memberFields.length}項目を変更`,
        fields: memberFields,
        id: `members-updated-${projectId}`,
        projectId,
        projectLabel,
        title: `${currentSchedule.project.workspace} のメンバー設定`,
      });
    }
  });

  rows.push(
    ...getTeamChangeRows({
      currentMembersById,
      currentTeams: currentWorkspace.teams,
      savedMembersById,
      savedTeams: savedWorkspace.teams,
    }),
  );

  return summarizeConfigChangeRows(rows);
}

function summarizeTaskChangeRows(rows: TaskChangeRow[]): TaskChangeReview {
  const addedCount = rows.filter((row) => row.kind === "added").length;
  const removedCount = rows.filter((row) => row.kind === "removed").length;
  const updatedCount = rows.filter((row) => row.kind === "updated").length;
  return {
    addedCount,
    fieldChangeCount: rows.reduce((total, row) => total + row.changeCount, 0),
    removedCount,
    rows,
    totalCount: rows.length,
    updatedCount,
  };
}

function summarizeConfigChangeRows(rows: ConfigChangeRow[]): ConfigChangeReview {
  return {
    calendarCount: rows.filter((row) => row.category === "calendar").length,
    fieldChangeCount: rows.reduce((total, row) => total + row.fields.length, 0),
    memberCount: rows.filter((row) => row.category === "member").length,
    projectCount: rows.filter((row) => row.category === "project").length,
    rows,
    teamCount: rows.filter((row) => row.category === "team").length,
    totalCount: rows.length,
  };
}

function getProjectFieldChanges(
  before: Project,
  after: Project,
  savedTeams: Team[],
  currentTeams: Team[],
  savedMembersById: Map<string, string>,
  currentMembersById: Map<string, string>,
) {
  const changes: TaskFieldChange[] = [];
  addChange(changes, "プロジェクト名", before.workspace, after.workspace);
  addChange(changes, "プロジェクトNo.", before.projectNo ?? "", after.projectNo ?? "");
  addChange(changes, "管理コード", before.name, after.name);
  addChange(
    changes,
    "所属チーム",
    formatTeamName(before.teamId, savedTeams),
    formatTeamName(after.teamId, currentTeams),
  );
  addChange(
    changes,
    "プロジェクトステータス",
    formatProjectLifecycleStatus(before),
    formatProjectLifecycleStatus(after),
  );
  addChange(
    changes,
    "プロジェクト要員",
    formatTeamMemberIds(before.memberIds ?? [], savedMembersById),
    formatTeamMemberIds(after.memberIds ?? [], currentMembersById),
  );
  addChange(
    changes,
    "アサイン計画",
    formatProjectAssignments(before.assignments ?? [], savedMembersById),
    formatProjectAssignments(after.assignments ?? [], currentMembersById),
  );
  addChange(
    changes,
    "要員要求",
    formatStaffingDemands(before.staffingDemands ?? []),
    formatStaffingDemands(after.staffingDemands ?? []),
  );
  addChange(changes, "開始日", before.rangeStart, after.rangeStart);
  addChange(changes, "終了日", before.rangeEnd, after.rangeEnd);
  addChange(
    changes,
    "次マイルストーン",
    `${before.nextMilestone.title} ${before.nextMilestone.date}`,
    `${after.nextMilestone.title} ${after.nextMilestone.date}`,
  );
  addChange(changes, "状態", formatProjectStatus(before), formatProjectStatus(after));
  return changes;
}

function formatProjectAssignments(
  assignments: NonNullable<Project["assignments"]>,
  membersById: Map<string, string>,
) {
  if (assignments.length === 0) {
    return "なし";
  }
  return [...assignments]
    .toSorted((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map(
      (assignment) =>
        `${membersById.get(assignment.memberId) ?? assignment.memberId} ${assignment.role} ${assignment.allocationPercent}% ${assignment.startDate}-${assignment.endDate} ${assignment.status === "confirmed" ? "確定" : "仮"}`,
    )
    .join(" / ");
}

function formatStaffingDemands(demands: NonNullable<Project["staffingDemands"]>) {
  if (demands.length === 0) {
    return "なし";
  }
  return [...demands]
    .toSorted((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map(
      (demand) =>
        `${demand.role} ${demand.requiredCount}名 ${demand.allocationPercent}% ${demand.startDate}-${demand.endDate} ${demand.status === "filled" ? "充足" : "未充足"}`,
    )
    .join(" / ");
}

function getCalendarFieldChanges(
  before: ScheduleWorkspace["schedules"][number]["calendar"],
  after: ScheduleWorkspace["schedules"][number]["calendar"],
) {
  const changes: TaskFieldChange[] = [];
  addChange(changes, "カレンダー名", before.name, after.name);
  addChange(changes, "稼働曜日", formatWorkWeek(before.workWeek), formatWorkWeek(after.workWeek));
  addChange(
    changes,
    "休日",
    formatCalendarHolidays(before.holidays),
    formatCalendarHolidays(after.holidays),
  );
  return changes;
}

function getMemberDirectoryFieldChanges(before: Member[], after: Member[]) {
  const changes: TaskFieldChange[] = [];
  addChange(
    changes,
    "有効メンバー",
    formatMemberNames(before, "active"),
    formatMemberNames(after, "active"),
  );
  addChange(
    changes,
    "休止メンバー",
    formatMemberNames(before, "inactive"),
    formatMemberNames(after, "inactive"),
  );
  addChange(changes, "週キャパ合計", formatCapacityTotal(before), formatCapacityTotal(after));
  addChange(
    changes,
    "非稼働日",
    formatAvailabilitySummary(before),
    formatAvailabilitySummary(after),
  );
  addChange(changes, "ロール", formatMemberRoles(before), formatMemberRoles(after));
  return changes;
}

function getTeamChangeRows({
  currentMembersById,
  currentTeams,
  savedMembersById,
  savedTeams,
}: {
  currentMembersById: Map<string, string>;
  currentTeams: Team[];
  savedMembersById: Map<string, string>;
  savedTeams: Team[];
}): ConfigChangeRow[] {
  const currentById = new Map(currentTeams.map((team) => [team.id, team]));
  const savedById = new Map(savedTeams.map((team) => [team.id, team]));
  const allIds = new Set([...currentById.keys(), ...savedById.keys()]);
  const rows: ConfigChangeRow[] = [];

  allIds.forEach((teamId) => {
    const before = savedById.get(teamId);
    const after = currentById.get(teamId);
    if (!before && after) {
      rows.push({
        category: "team",
        detail: "新しいチーム",
        fields: [
          { after: after.name, before: "-", label: "チーム名" },
          {
            after: formatTeamMemberIds(after.memberIds, currentMembersById),
            before: "-",
            label: "所属メンバー",
          },
        ],
        id: `team-added-${teamId}`,
        title: after.name,
      });
      return;
    }
    if (before && !after) {
      rows.push({
        category: "team",
        detail: "チームを削除",
        fields: [
          { after: "-", before: before.name, label: "チーム名" },
          {
            after: "-",
            before: formatTeamMemberIds(before.memberIds, savedMembersById),
            label: "所属メンバー",
          },
        ],
        id: `team-removed-${teamId}`,
        title: before.name,
      });
      return;
    }
    if (!before || !after) {
      return;
    }
    const fields: TaskFieldChange[] = [];
    addChange(fields, "チーム名", before.name, after.name);
    addChange(fields, "チーム記号", before.code, after.code);
    addChange(fields, "説明", before.description, after.description);
    addChange(
      fields,
      "所属メンバー",
      formatTeamMemberIds(before.memberIds, savedMembersById),
      formatTeamMemberIds(after.memberIds, currentMembersById),
    );
    if (fields.length === 0) {
      return;
    }
    rows.push({
      category: "team",
      detail: `${fields.length}項目を変更`,
      fields,
      id: `team-updated-${teamId}`,
      title: after.name,
    });
  });

  return rows;
}

function getTaskFieldChanges(
  before: ScheduleTask,
  after: ScheduleTask,
  currentTasks: ScheduleTask[],
  savedTasks: ScheduleTask[],
  members: Member[],
) {
  const changes: TaskFieldChange[] = [];
  addChange(changes, "タスク名", before.title, after.title, "title");
  addChange(changes, "種類", taskTypeLabels[before.type], taskTypeLabels[after.type]);
  addChange(changes, "状態", statusLabels[before.status], statusLabels[after.status], "status");
  addChange(changes, "開始日", before.start, after.start, "start");
  addChange(changes, "終了日", before.end, after.end, "end");
  addChange(changes, "進捗", `${before.progress}%`, `${after.progress}%`, "progress");
  addChange(
    changes,
    "担当",
    formatAssignees(before.assigneeIds, members),
    formatAssignees(after.assigneeIds, members),
    "assignees",
  );
  addChange(
    changes,
    "配分",
    formatAssigneeAllocations(before, members),
    formatAssigneeAllocations(after, members),
    "allocations",
  );
  addChange(
    changes,
    "階層",
    formatParent(before.parentId, savedTasks),
    formatParent(after.parentId, currentTasks),
  );
  addChange(
    changes,
    "依存",
    formatDependencies(before.dependencies ?? [], savedTasks),
    formatDependencies(after.dependencies ?? [], currentTasks),
    "dependencies",
  );
  addChange(
    changes,
    "予定工数",
    formatEffort(before.effortHours),
    formatEffort(after.effortHours),
    "effort",
  );
  addChange(changes, "基準計画", formatBaseline(before), formatBaseline(after), "baseline");
  addChange(
    changes,
    "詳細",
    formatDetailSummary(before),
    formatDetailSummary(after),
    "description",
  );
  return changes;
}

function addChange(
  changes: TaskFieldChange[],
  label: string,
  before: string,
  after: string,
  focusTarget?: TaskInspectorFocusTarget,
) {
  if (before === after) {
    return;
  }
  changes.push({ after, before, focusTarget, label });
}

function formatAssignees(assigneeIds: string[], members: Member[]) {
  if (assigneeIds.length === 0) {
    return "未設定";
  }
  return assigneeIds
    .map((id) => {
      const member = members.find((item) => item.id === id);
      return member ? member.initials : id;
    })
    .join(", ");
}

function formatAssigneeAllocations(task: ScheduleTask, members: Member[]) {
  if (task.assigneeIds.length <= 1) {
    return "100%";
  }
  const allocationMap = getTaskAssigneeAllocationMap(task);
  return task.assigneeIds
    .map((id) => {
      const member = members.find((item) => item.id === id);
      return `${member?.initials ?? id} ${Math.round(allocationMap.get(id) ?? 0)}%`;
    })
    .join(", ");
}

function formatParent(parentId: string | null, tasks: ScheduleTask[]) {
  if (!parentId) {
    return "最上位";
  }
  return tasks.find((task) => task.id === parentId)?.title ?? parentId;
}

function formatDependencies(dependencyIds: string[], tasks: ScheduleTask[]) {
  if (dependencyIds.length === 0) {
    return "なし";
  }
  return dependencyIds.map((id) => tasks.find((task) => task.id === id)?.title ?? id).join(" / ");
}

function formatEffort(effortHours?: number) {
  return effortHours == null ? "未設定" : `${effortHours}h`;
}

function formatBaseline(task: ScheduleTask) {
  if (!task.baselineStart || !task.baselineEnd) {
    return "なし";
  }
  return `${task.baselineStart} - ${task.baselineEnd}`;
}

function formatProjectStatus(project: Project) {
  return project.status === "archived" ? "アーカイブ" : "有効";
}

function formatProjectLifecycleStatus(project: Project) {
  return projectLifecycleLabels[getProjectLifecycleStatus(project)];
}

function formatTeamName(teamId: string | null, teams: Team[]) {
  if (teamId === null) {
    return "未所属";
  }
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

function formatWorkWeek(days: number[]) {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return [...days]
    .toSorted((a, b) => a - b)
    .map((day) => labels[day] ?? String(day))
    .join(", ");
}

function formatCalendarHolidays(
  holidays: ScheduleWorkspace["schedules"][number]["calendar"]["holidays"],
) {
  if (holidays.length === 0) {
    return "なし";
  }
  return [...holidays]
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .map((holiday) => `${holiday.date} ${holiday.name}`)
    .join(" / ");
}

function formatMemberNames(members: Member[], status: "active" | "inactive") {
  const names = members
    .filter((member) =>
      status === "active" ? member.status !== "inactive" : member.status === "inactive",
    )
    .map((member) => member.name)
    .toSorted((a, b) => a.localeCompare(b, "ja"));
  return names.length > 0 ? names.join(", ") : "なし";
}

function formatCapacityTotal(members: Member[]) {
  const total = members
    .filter((member) => member.status !== "inactive")
    .reduce((sum, member) => sum + member.capacityHours, 0);
  return `${total}h/週`;
}

function formatAvailabilitySummary(members: Member[]) {
  const rows = members
    .flatMap((member) =>
      (member.availabilityOverrides ?? []).map(
        (override) => `${member.name}:${override.date} ${override.label}`,
      ),
    )
    .toSorted((a, b) => a.localeCompare(b, "ja"));
  return rows.length > 0 ? rows.join(" / ") : "なし";
}

function formatMemberRoles(members: Member[]) {
  return members
    .map((member) => `${member.initials}:${member.role}`)
    .toSorted((a, b) => a.localeCompare(b, "ja"))
    .join(", ");
}

function formatTeamMemberIds(memberIds: string[], membersById: Map<string, string>) {
  if (memberIds.length === 0) {
    return "なし";
  }
  return [...memberIds]
    .toSorted((a, b) => a.localeCompare(b))
    .map((memberId) => membersById.get(memberId) ?? memberId)
    .join(", ");
}

function getWorkspaceMemberNameMap(workspace: ScheduleWorkspace) {
  const members = new Map<string, string>();
  workspace.schedules.forEach((schedule) => {
    schedule.members.forEach((member) => {
      if (!members.has(member.id)) {
        members.set(member.id, member.name);
      }
    });
  });
  return members;
}

function formatDetailSummary(task: ScheduleTask) {
  const count =
    (task.description?.trim() ? 1 : 0) +
    (task.checklist?.length ?? 0) +
    (task.comments?.length ?? 0) +
    (task.links?.length ?? 0);
  return count === 0 ? "なし" : `${count}件`;
}
