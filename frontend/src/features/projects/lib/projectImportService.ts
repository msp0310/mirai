import {
  ProjectImportError,
  type TaskCsvImportDraft,
  parseTaskCsvImportFromDraft,
  validateTaskCsvImportData,
} from "../../../data/scheduleImportExport";
import type { ScheduleSnapshot, ScheduleWorkspace } from "../../../data/scheduleRepository";
import { normalizeSummaryTasks } from "../../../lib/taskOperations";
import type { Member, Project, ScheduleTask, Team } from "../../../types/schedule";
import type {
  PendingProjectImport,
  PendingTaskCsvImport,
  TaskCsvImportOptions,
} from "../types/projectImport";

type CreatePendingTaskImportInput = {
  calendar: ScheduleSnapshot["calendar"];
  draft: TaskCsvImportDraft;
  fileName: string;
  members: Member[];
  membersToCreate?: Member[];
  project: Project;
  sourceKind?: PendingTaskCsvImport["sourceKind"];
  warnings?: string[];
};

export type PreparedTaskImport = {
  membersToCreate: Member[];
  nextProject: Project;
  nextTasks: ScheduleTask[];
  sourceLabel: string;
};

export type PreparedProjectImport = {
  importedProjectId: string;
  nextSchedule: ScheduleSnapshot;
  nextTasks: ScheduleTask[];
  nextTeam: Team | null;
  nextTeamId: string | null;
  projectIdChanged: boolean;
  replaceExisting: boolean;
};

/** CSVまたはBrabioの解析結果から、確認画面で扱う保留データを作成します。 */
export function createPendingTaskImport({
  calendar,
  draft,
  fileName,
  members,
  membersToCreate: sourceMembers = [],
  project,
  sourceKind = "csv",
  warnings: sourceWarnings = [],
}: CreatePendingTaskImportInput): PendingTaskCsvImport {
  const membersToCreate = dedupeImportMembers(members, sourceMembers);
  const importMembers = [...members, ...membersToCreate];
  try {
    const imported = parseTaskCsvImportFromDraft(draft, { members: importMembers });
    const validation = validateTaskCsvImportData(imported, {
      calendar,
      members: importMembers,
      project,
    });
    return {
      data: imported,
      draft,
      fileName,
      membersToCreate,
      sourceKind,
      sourceWarnings,
      validation: {
        ...validation,
        warnings: uniqueStrings([
          ...(sourceKind === "brabio"
            ? validation.warnings.filter((message) => !isOptionalAssigneeWarning(message))
            : validation.warnings),
          ...sourceWarnings,
          ...(membersToCreate.length > 0
            ? [`Brabioから未登録メンバー${membersToCreate.length}名を追加します。`]
            : []),
        ]),
      },
    };
  } catch (error) {
    return {
      data: null,
      draft,
      fileName,
      membersToCreate,
      sourceKind,
      sourceWarnings,
      validation: {
        errors: [
          error instanceof ProjectImportError || error instanceof Error
            ? error.message
            : "ファイルの内容を確認してください。",
        ],
        warnings: sourceWarnings,
      },
    };
  }
}

/** 確認済みタスク取込を、案件へ反映できる形へ正規化します。 */
export function prepareTaskImport(
  pending: PendingTaskCsvImport,
  options: TaskCsvImportOptions,
  project: Project,
): PreparedTaskImport | null {
  if (pending.data === null || pending.validation.errors.length > 0) {
    return null;
  }
  const nextTasks = normalizeSummaryTasks(pending.data.tasks);
  const csvRange = getImportedTaskRange(nextTasks, project);
  const shouldExpandProjectRange =
    options.expandProjectRange &&
    csvRange !== null &&
    (csvRange.start !== project.rangeStart || csvRange.end !== project.rangeEnd);
  return {
    membersToCreate: pending.membersToCreate,
    nextProject:
      shouldExpandProjectRange && csvRange
        ? { ...project, rangeEnd: csvRange.end, rangeStart: csvRange.start }
        : project,
    nextTasks,
    sourceLabel: getTaskImportSourceLabel(pending.sourceKind),
  };
}

/** タスク取込で追加された案件・メンバー情報をワークスペースへ反映します。 */
export function mergeTaskImportIntoWorkspace(
  workspace: ScheduleWorkspace,
  projectId: string,
  nextProject: Project,
  membersToCreate: Member[],
  activeTeamId?: string,
) {
  return {
    ...workspace,
    schedules: workspace.schedules.map((snapshot) =>
      snapshot.project.id === projectId
        ? {
            ...snapshot,
            members: addMissingMembers(snapshot.members, membersToCreate),
            project: nextProject,
          }
        : {
            ...snapshot,
            members: addMissingMembers(snapshot.members, membersToCreate),
          },
    ),
    teams:
      membersToCreate.length === 0
        ? workspace.teams
        : workspace.teams.map((team) =>
            team.id === activeTeamId
              ? {
                  ...team,
                  memberIds: uniqueStrings([
                    ...team.memberIds,
                    ...membersToCreate.map((member) => member.id),
                  ]),
                }
              : team,
          ),
  };
}

/** プロジェクト取込を、新規追加または上書きできる形へ正規化します。 */
export function prepareProjectImport(
  pending: PendingProjectImport,
  mode: "add" | "replace",
  workspace: ScheduleWorkspace,
  activeTeamId: string,
): PreparedProjectImport {
  const imported = pending.data;
  const existingSchedule = workspace.schedules.find(
    (snapshot) => snapshot.project.id === imported.project.id,
  );
  const replaceExisting = mode === "replace" && existingSchedule != null;
  const existingProjectIds = new Set(workspace.schedules.map((snapshot) => snapshot.project.id));
  const importedProjectId = replaceExisting
    ? imported.project.id
    : createUniqueImportedId(imported.project.id, existingProjectIds);
  const projectIdChanged = importedProjectId !== imported.project.id;
  const existingTeamIds = new Set(workspace.teams.map((team) => team.id));
  const importedTeamId = imported.team?.id ?? imported.project.teamId;
  const teamExists = importedTeamId != null && existingTeamIds.has(importedTeamId);
  const nextTeamId = teamExists
    ? importedTeamId
    : imported.team
      ? createUniqueImportedId(imported.team.id, existingTeamIds)
      : (existingSchedule?.project.teamId ?? activeTeamId);
  const nextTeam =
    imported.team && !teamExists ? { ...imported.team, id: nextTeamId ?? imported.team.id } : null;
  const nextTasks = normalizeSummaryTasks(imported.tasks);
  const nextSchedule: ScheduleSnapshot = {
    calendar: imported.calendar,
    members: imported.members,
    project: {
      ...imported.project,
      archivedAt: undefined,
      id: importedProjectId,
      name: projectIdChanged ? `${imported.project.name}（インポート）` : imported.project.name,
      status: "active",
      teamId: nextTeamId,
      workspace: projectIdChanged
        ? `${imported.project.workspace}（インポート）`
        : imported.project.workspace,
    },
    tasks: nextTasks,
  };
  return {
    importedProjectId,
    nextSchedule,
    nextTasks,
    nextTeam,
    nextTeamId,
    projectIdChanged,
    replaceExisting,
  };
}

export function getTaskImportSourceLabel(sourceKind: PendingTaskCsvImport["sourceKind"]) {
  return sourceKind === "brabio" ? "Brabio XLSX" : "タスクCSV";
}

function createUniqueImportedId(baseId: string, existingIds: Set<string>) {
  const base = baseId.trim() || "imported-project";
  if (!existingIds.has(base)) {
    return base;
  }
  let suffix = 2;
  let candidate = `${base}-import`;
  while (existingIds.has(candidate)) {
    candidate = `${base}-import-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function dedupeImportMembers(existingMembers: Member[], members: Member[]) {
  const existingIds = new Set(existingMembers.map((member) => member.id));
  const nextIds = new Set<string>();
  return members.filter((member) => {
    if (existingIds.has(member.id) || nextIds.has(member.id)) {
      return false;
    }
    nextIds.add(member.id);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function isOptionalAssigneeWarning(message: string) {
  return message.endsWith("に担当者が設定されていません。");
}

function addMissingMembers(currentMembers: Member[], membersToCreate: Member[]) {
  if (membersToCreate.length === 0) {
    return currentMembers;
  }
  const currentIds = new Set(currentMembers.map((member) => member.id));
  const additions = membersToCreate.filter((member) => !currentIds.has(member.id));
  return additions.length === 0 ? currentMembers : [...currentMembers, ...additions];
}

function getImportedTaskRange(tasks: ScheduleTask[], project: Project) {
  if (tasks.length === 0) {
    return null;
  }
  return {
    end: tasks.reduce((latest, task) => (task.end > latest ? task.end : latest), project.rangeEnd),
    start: tasks.reduce(
      (earliest, task) => (task.start < earliest ? task.start : earliest),
      project.rangeStart,
    ),
  };
}
