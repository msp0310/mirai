import type {
  CalendarDefinition,
  Member,
  MemberAvailabilityOverride,
  MemberAvailabilityOverrideType,
  MemberStatus,
  Project,
  ProjectAssignment,
  ProjectIssue,
  ProjectIssueGitHubLink,
  ProjectIssuePriority,
  ProjectIssueReply,
  ProjectIssueStatus,
  ProjectIssueType,
  ProjectLifecycleStatus,
  ProjectWorkLog,
  ScheduleTask,
  StaffingDemand,
  TaskAssigneeAllocation,
  TaskChecklistItem,
  TaskComment,
  TaskReferenceLink,
  TaskStatus,
  TaskType,
  Team,
} from "../types/schedule";
import type { ScheduleSnapshot } from "./scheduleRepository";

export type ProjectImportData = ScheduleSnapshot & {
  team?: Team;
};

export type TaskCsvImportData = {
  sourceRows: number;
  tasks: ScheduleTask[];
};

export type BrabioXlsxImportData = {
  draft: TaskCsvImportDraft;
  members: Member[];
  projectTitle: string | null;
  warnings: string[];
};

export type TaskCsvColumn =
  | "assignees"
  | "dependencies"
  | "effortHours"
  | "end"
  | "id"
  | "parentId"
  | "progress"
  | "start"
  | "status"
  | "title"
  | "type";

export type TaskCsvImportMapping = Partial<Record<TaskCsvColumn, number>>;

export type TaskCsvImportDraft = {
  headers: string[];
  mapping: TaskCsvImportMapping;
  rows: string[][];
  sourceRows: number;
};

export type TaskCsvImportContext = {
  members: Member[];
};

export type TaskCsvImportValidationContext = {
  calendar: CalendarDefinition;
  members: Member[];
  project: Project;
};

export type ProjectImportValidation = {
  errors: string[];
  warnings: string[];
};

/** プロジェクト取込データがCOMPASSの契約に合わないことを表します。 */
export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectImportError";
  }
}
export function parseProjectImportJson(source: string): ProjectImportData {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new ProjectImportError("JSONの形式を確認してください。");
  }

  const record = assertRecord(parsed, "インポートファイル");
  return {
    calendar: parseCalendar(record.calendar),
    issues: record.issues == null ? [] : readArray(record.issues, "issues").map(parseProjectIssue),
    members: readArray(record.members, "members").map(parseMember),
    project: parseProject(record.project),
    tasks: readArray(record.tasks, "tasks").map(parseTask),
    team: record.team == null ? undefined : parseTeam(record.team),
    workLogs:
      record.workLogs == null
        ? []
        : readArray(record.workLogs, "workLogs").map(parseProjectWorkLog),
  };
}

function parseProjectIssue(value: unknown): ProjectIssue {
  const record = assertRecord(value, "issues");
  const assigneeIds =
    record.assigneeIds == null
      ? []
      : readArray(record.assigneeIds, "issues.assigneeIds").map((id) =>
          readString(id, "issues.assigneeIds"),
        );
  const taskIds =
    record.taskIds == null
      ? []
      : readArray(record.taskIds, "issues.taskIds").map((id) => readString(id, "issues.taskIds"));
  const dueDate = record.dueDate == null ? undefined : readDate(record.dueDate, "issues.dueDate");
  const closedAt =
    record.closedAt == null ? undefined : readString(record.closedAt, "issues.closedAt");
  const github = record.github == null ? undefined : parseProjectIssueGitHubLink(record.github);
  const replies =
    record.replies == null
      ? []
      : readArray(record.replies, "issues.replies").map(parseProjectIssueReply);

  return {
    assigneeIds,
    body: record.body == null ? "" : readString(record.body, "issues.body"),
    closedAt,
    createdAt: readString(record.createdAt, "issues.createdAt"),
    dueDate,
    github,
    id: readString(record.id, "issues.id"),
    priority: readProjectIssuePriority(record.priority),
    replies,
    status: readProjectIssueStatus(record.status),
    taskIds,
    title: readString(record.title, "issues.title"),
    type: readProjectIssueType(record.type),
    updatedAt: readString(record.updatedAt, "issues.updatedAt"),
  };
}

function parseProjectIssueReply(value: unknown): ProjectIssueReply {
  const record = assertRecord(value, "issues.replies");
  return {
    authorId:
      record.authorId == null ? undefined : readString(record.authorId, "issues.replies.authorId"),
    authorName: readString(record.authorName, "issues.replies.authorName"),
    body: readString(record.body, "issues.replies.body"),
    createdAt: readString(record.createdAt, "issues.replies.createdAt"),
    id: readString(record.id, "issues.replies.id"),
    updatedAt:
      record.updatedAt == null
        ? undefined
        : readString(record.updatedAt, "issues.replies.updatedAt"),
  };
}

function parseProjectIssueGitHubLink(value: unknown): ProjectIssueGitHubLink {
  const record = assertRecord(value, "issues.github");
  return {
    issueNumber:
      record.issueNumber == null
        ? undefined
        : readNumber(record.issueNumber, "issues.github.issueNumber"),
    lastSyncedAt:
      record.lastSyncedAt == null
        ? undefined
        : readString(record.lastSyncedAt, "issues.github.lastSyncedAt"),
    repository:
      record.repository == null
        ? undefined
        : readString(record.repository, "issues.github.repository"),
    state: record.state === "open" || record.state === "closed" ? record.state : undefined,
    syncStatus:
      record.syncStatus === "linked" ||
      record.syncStatus === "pending" ||
      record.syncStatus === "synced" ||
      record.syncStatus === "error" ||
      record.syncStatus === "unlinked"
        ? record.syncStatus
        : undefined,
    url: record.url == null ? undefined : readString(record.url, "issues.github.url"),
  };
}

function parseProjectWorkLog(value: unknown): ProjectWorkLog {
  const record = assertRecord(value, "workLogs");
  return {
    billable: record.billable == null ? true : readBoolean(record.billable, "workLogs.billable"),
    category: readWorkLogCategory(record.category),
    createdAt: readString(record.createdAt, "workLogs.createdAt"),
    createdBy: readString(record.createdBy, "workLogs.createdBy"),
    date: readDate(record.date, "workLogs.date"),
    dailyReportEntryId:
      record.dailyReportEntryId == null
        ? undefined
        : readString(record.dailyReportEntryId, "workLogs.dailyReportEntryId"),
    dailyReportId:
      record.dailyReportId == null
        ? undefined
        : readString(record.dailyReportId, "workLogs.dailyReportId"),
    hours: readNumber(record.hours, "workLogs.hours"),
    id: readString(record.id, "workLogs.id"),
    issueId: record.issueId == null ? undefined : readString(record.issueId, "workLogs.issueId"),
    memberId: readString(record.memberId, "workLogs.memberId"),
    note: record.note == null ? undefined : readString(record.note, "workLogs.note"),
    summary: readString(record.summary, "workLogs.summary"),
    taskId: record.taskId == null ? undefined : readString(record.taskId, "workLogs.taskId"),
    updatedAt: readString(record.updatedAt, "workLogs.updatedAt"),
  };
}
export function parseTaskCsvImport(
  source: string,
  context: TaskCsvImportContext,
): TaskCsvImportData {
  return parseTaskCsvImportFromDraft(createTaskCsvImportDraft(source), context);
}
export function createTaskCsvImportDraft(source: string): TaskCsvImportDraft {
  const rows = parseCsvRows(source);
  if (rows.length === 0) {
    throw new ProjectImportError("CSVに行がありません。");
  }

  const dataRows = rows.slice(1).filter((row) => !isBlankCsvRow(row));
  if (dataRows.length === 0) {
    throw new ProjectImportError("取り込めるタスク行がありません。");
  }

  return {
    headers: rows[0].map((header) => header.trim()),
    mapping: buildTaskCsvColumns(rows[0]),
    rows: dataRows,
    sourceRows: dataRows.length,
  };
}

/** BrabioのXLSXを読み込み、確認画面へ渡す中間データを作成します。 */
export async function createBrabioXlsxImportDraft(file: File): Promise<BrabioXlsxImportData> {
  const xlsx = await import("@e965/xlsx");
  const workbook = xlsx.read(await file.arrayBuffer(), { cellDates: true, type: "array" });
  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    throw new ProjectImportError("Brabio XLSXにシートがありません。");
  }
  const rows = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    blankrows: false,
    defval: "",
    header: 1,
    raw: true,
  });
  const headerIndex = findBrabioHeaderRow(rows);
  if (headerIndex < 0) {
    throw new ProjectImportError("Brabioのタスク一覧ヘッダーが見つかりません。");
  }

  const header = rows[headerIndex].map((value) => String(value).trim());
  const columns = getBrabioColumns(header);
  const taskRows = rows
    .slice(headerIndex + 1)
    .map((row, index) => readBrabioRow(row, index + headerIndex + 3, columns))
    .filter((row): row is BrabioRawTaskRow => row !== null);

  if (taskRows.length === 0) {
    throw new ProjectImportError("Brabio XLSXに取り込めるタスク行がありません。");
  }

  const memberResult = collectBrabioMembers(taskRows);
  const convertedRows = convertBrabioRowsToTaskRows(taskRows, memberResult.memberIdByName);
  const warnings = [...memberResult.warnings, ...convertedRows.warnings];

  return {
    draft: {
      headers: brabioTaskImportHeaders,
      mapping: brabioTaskImportMapping,
      rows: convertedRows.rows,
      sourceRows: convertedRows.rows.length,
    },
    members: memberResult.members,
    projectTitle: taskRows.find((row) => row.type === "project")?.title ?? null,
    warnings,
  };
}
export function parseTaskCsvImportFromDraft(
  draft: TaskCsvImportDraft,
  context: TaskCsvImportContext,
  mapping: TaskCsvImportMapping = draft.mapping,
): TaskCsvImportData {
  const columns = normalizeTaskCsvMapping(mapping);
  const missingRequiredColumns = taskCsvRequiredColumns.filter((column) => columns[column] == null);
  if (missingRequiredColumns.length > 0) {
    throw new ProjectImportError(
      `CSVに必要な列がありません: ${missingRequiredColumns
        .map((column) => taskCsvColumnLabels[column])
        .join(", ")}`,
    );
  }

  const duplicateMappedHeaders = getDuplicates(
    Object.values(columns)
      .filter((index): index is number => index != null)
      .map((index) => draft.headers[index] ?? `${index + 1}列目`),
  );
  if (duplicateMappedHeaders.length > 0) {
    throw new ProjectImportError(
      `同じCSV列が複数フィールドに割り当てられています: ${duplicateMappedHeaders.join(", ")}`,
    );
  }

  const memberLookup = createMemberLookup(context.members);
  const tasks = draft.rows.map((row, index) =>
    parseTaskCsvRow(row, index + 2, columns, memberLookup),
  );

  if (tasks.length === 0) {
    throw new ProjectImportError("取り込めるタスク行がありません。");
  }

  return {
    sourceRows: tasks.length,
    tasks,
  };
}
export function validateTaskCsvImportData(
  data: TaskCsvImportData,
  context: TaskCsvImportValidationContext,
): ProjectImportValidation {
  return validateProjectImportData({
    calendar: context.calendar,
    members: context.members,
    project: context.project,
    tasks: data.tasks,
  });
}
export function validateProjectImportData(data: ProjectImportData): ProjectImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const memberIds = new Set(data.members.map((member) => member.id));
  const taskIds = new Set(data.tasks.map((task) => task.id));
  const duplicateMemberIds = getDuplicates(data.members.map((member) => member.id));
  const duplicateTaskIds = getDuplicates(data.tasks.map((task) => task.id));
  const duplicateHolidayDates = getDuplicates(
    data.calendar.holidays.map((holiday) => holiday.date),
  );

  if (data.tasks.length === 0) {
    errors.push("タスクが1件もありません。");
  }
  if (duplicateMemberIds.length > 0) {
    errors.push(`メンバーIDが重複しています: ${duplicateMemberIds.join(", ")}`);
  }
  if (duplicateTaskIds.length > 0) {
    errors.push(`タスクIDが重複しています: ${duplicateTaskIds.join(", ")}`);
  }
  if (duplicateHolidayDates.length > 0) {
    warnings.push(`休日が重複しています: ${duplicateHolidayDates.join(", ")}`);
  }
  if (new Set(data.calendar.workWeek).size !== data.calendar.workWeek.length) {
    warnings.push("稼働曜日が重複しています。");
  }
  if (data.project.rangeEnd < data.project.rangeStart) {
    errors.push("プロジェクト終了日が開始日より前です。");
  }
  if (!isValidDateKey(data.project.rangeStart) || !isValidDateKey(data.project.rangeEnd)) {
    errors.push("プロジェクト期間の日付が実在しません。");
  }
  if (!isValidDateKey(data.project.nextMilestone.date)) {
    errors.push("次のマイルストーン日が実在しません。");
  } else if (
    data.project.nextMilestone.date < data.project.rangeStart ||
    data.project.nextMilestone.date > data.project.rangeEnd
  ) {
    warnings.push("次のマイルストーンがプロジェクト期間外です。");
  }
  if (data.team && data.team.id !== data.project.teamId) {
    warnings.push("チーム定義のIDとプロジェクトのteamIdが異なります。");
  }
  if (data.team && data.team.memberIds.some((memberId) => !memberIds.has(memberId))) {
    errors.push("チーム所属メンバーに存在しないメンバーIDがあります。");
  }
  if (data.project.memberIds?.some((memberId) => !memberIds.has(memberId))) {
    errors.push("プロジェクト要員に存在しないメンバーIDがあります。");
  }
  if (data.project.assignments?.some((assignment) => !memberIds.has(assignment.memberId))) {
    errors.push("アサイン計画に存在しないメンバーIDがあります。");
  }
  const duplicateAssignmentIds = getDuplicates(
    (data.project.assignments ?? []).map((assignment) => assignment.id),
  );
  if (duplicateAssignmentIds.length > 0) {
    errors.push(`アサイン計画IDが重複しています: ${duplicateAssignmentIds.join(", ")}`);
  }
  (data.project.assignments ?? []).forEach((assignment) => {
    if (
      assignment.startDate > assignment.endDate ||
      assignment.allocationPercent < 1 ||
      assignment.allocationPercent > 100
    ) {
      errors.push(`アサイン計画「${assignment.id}」の期間または配分率が不正です。`);
    }
  });
  (data.project.staffingDemands ?? []).forEach((demand) => {
    if (
      demand.startDate > demand.endDate ||
      demand.requiredCount < 1 ||
      demand.allocationPercent < 1 ||
      demand.allocationPercent > 100
    ) {
      errors.push(`要員要求「${demand.id}」の内容が不正です。`);
    }
  });
  if (
    data.team &&
    data.project.memberIds?.some((memberId) => !data.team?.memberIds.includes(memberId))
  ) {
    warnings.push("プロジェクト要員にチーム所属外のメンバーが含まれています。");
  }
  if (data.tasks.every((task) => task.parentId !== null)) {
    errors.push("ルートタスクがありません。");
  }

  data.members.forEach((member) => {
    if (member.capacityHours <= 0) {
      warnings.push(`${member.name} の稼働時間が0以下です。`);
    }
  });

  data.tasks.forEach((task) => {
    if (!isValidDateKey(task.start) || !isValidDateKey(task.end)) {
      errors.push(`${task.title} の開始日または終了日が実在しません。`);
    }
    if (task.end < task.start) {
      errors.push(`${task.title} の終了日が開始日より前です。`);
    }
    if (task.start < data.project.rangeStart || task.end > data.project.rangeEnd) {
      warnings.push(`${task.title} がプロジェクト期間外にあります。`);
    }
    if (task.type === "milestone" && task.start !== task.end) {
      errors.push(`${task.title} はマイルストーンですが開始日と終了日が異なります。`);
    }
    if (
      task.baselineStart != null &&
      task.baselineEnd != null &&
      task.baselineEnd < task.baselineStart
    ) {
      errors.push(`${task.title} の基準計画終了日が開始日より前です。`);
    }
    if (
      (task.baselineStart != null && !isValidDateKey(task.baselineStart)) ||
      (task.baselineEnd != null && !isValidDateKey(task.baselineEnd))
    ) {
      errors.push(`${task.title} の基準計画日付が実在しません。`);
    }
    if (task.parentId === task.id) {
      errors.push(`${task.title} の親IDが自分自身です。`);
    }
    if (task.parentId !== null && !taskIds.has(task.parentId)) {
      errors.push(`${task.title} の親タスクが見つかりません。`);
    }
    const parent = task.parentId
      ? data.tasks.find((candidate) => candidate.id === task.parentId)
      : null;
    if (parent && parent.type !== "summary" && parent.type !== "phase") {
      errors.push(`${task.title} の親タスクはフェーズまたはサマリーではありません。`);
    }
    task.assigneeIds.forEach((assigneeId) => {
      if (!memberIds.has(assigneeId)) {
        errors.push(`${task.title} の担当者ID「${assigneeId}」が見つかりません。`);
      }
    });
    const allocationMemberIds = new Set(task.assigneeIds);
    (task.assigneeAllocations ?? []).forEach((allocation) => {
      if (!allocationMemberIds.has(allocation.memberId)) {
        warnings.push(
          `${task.title} の担当配分に担当者ではないメンバーID「${allocation.memberId}」があります。`,
        );
      }
      if (allocation.percent < 0 || allocation.percent > 100) {
        warnings.push(`${task.title} の担当配分が0-100%の範囲外です。`);
      }
    });
    const allocationTotal = (task.assigneeAllocations ?? []).reduce(
      (sum, allocation) => sum + allocation.percent,
      0,
    );
    if (
      task.assigneeAllocations != null &&
      task.assigneeAllocations.length > 0 &&
      Math.round(allocationTotal) !== 100
    ) {
      warnings.push(`${task.title} の担当配分合計が100%ではありません。`);
    }
    if (task.assigneeIds.length === 0 && task.type !== "summary") {
      warnings.push(`${task.title} に担当者が設定されていません。`);
    }
    (task.dependencies ?? []).forEach((dependencyId) => {
      if (dependencyId === task.id) {
        errors.push(`${task.title} が自分自身に依存しています。`);
      } else if (!taskIds.has(dependencyId)) {
        errors.push(`${task.title} の依存タスク「${dependencyId}」が見つかりません。`);
      }
    });
  });

  findParentCycles(data.tasks).forEach((title) => {
    errors.push(`${title} の階層に循環があります。`);
  });
  findDependencyCycles(data.tasks).forEach((title) => {
    errors.push(`${title} の依存関係に循環があります。`);
  });

  return {
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}

export const taskCsvRequiredColumns: TaskCsvColumn[] = ["title", "start", "end"];

export const taskCsvColumnLabels: Record<TaskCsvColumn, string> = {
  assignees: "担当者",
  dependencies: "依存",
  effortHours: "工数",
  end: "終了日",
  id: "ID",
  parentId: "親ID",
  progress: "進捗",
  start: "開始日",
  status: "状態",
  title: "タスク名",
  type: "種別",
};

const taskCsvHeaderAliases: Record<TaskCsvColumn, string[]> = {
  assignees: ["担当者", "担当", "担当者ID", "assignees", "assigneeIds"],
  dependencies: ["依存", "依存ID", "先行", "先行タスク", "dependencies"],
  effortHours: ["工数", "工数h", "工数(h)", "時間", "effortHours"],
  end: ["終了日", "終了", "期限", "end", "endDate"],
  id: ["ID", "id", "taskId", "task_id", "タスクID"],
  parentId: ["親ID", "親", "上位ID", "parentId", "parent_id", "parent"],
  progress: ["進捗", "進捗率", "progress"],
  start: ["開始日", "開始", "start", "startDate"],
  status: ["状態", "ステータス", "status"],
  title: ["タスク名", "名称", "件名", "title", "name"],
  type: ["種別", "タスク種別", "type"],
};

const taskCsvStatusMap: Record<string, TaskStatus> = {
  delayed: "delayed",
  done: "done",
  inprogress: "inProgress",
  notstarted: "notStarted",
  作業中: "inProgress",
  完了: "done",
  未開始: "notStarted",
  未着手: "notStarted",
  済: "done",
  着手: "inProgress",
  進行中: "inProgress",
  遅れ: "delayed",
  遅延: "delayed",
};

const taskCsvTypeMap: Record<string, TaskType> = {
  milestone: "milestone",
  phase: "phase",
  summary: "summary",
  task: "task",
  サマリー: "summary",
  タスク: "task",
  フェーズ: "phase",
  マイルストーン: "milestone",
  作業: "task",
  工程: "phase",
  親: "summary",
};

const taskCsvPalette = ["#89b7ff", "#9addb8", "#ffc184", "#c7d2fe", "#8bd4d2"];

const taskCsvTypeColors: Record<TaskType, string> = {
  milestone: "#f7933d",
  phase: "#0ea5a3",
  summary: "#5865e8",
  task: taskCsvPalette[0],
};

type BrabioColumnKey =
  | "assigneeIds"
  | "assignees"
  | "completedAt"
  | "end"
  | "id"
  | "outline"
  | "progress"
  | "status"
  | "situation"
  | "start"
  | "title"
  | "type";

type BrabioRawTaskRow = {
  assigneeIds: string[];
  assignees: string[];
  completedAt: string;
  end: string;
  id: string;
  outline: number;
  progress: number;
  rowNumber: number;
  situation: string;
  start: string;
  status: string;
  title: string;
  type: string;
};

type BrabioResolvedTaskRow = BrabioRawTaskRow & {
  end: string;
  parentId: string | null;
  start: string;
  taskId: string;
  taskType: TaskType;
};

const brabioColumnAliases: Record<BrabioColumnKey, string[]> = {
  assigneeIds: ["メンバーID", "担当者ID"],
  assignees: ["メンバー", "担当者", "担当"],
  completedAt: ["完了日"],
  end: ["〆切日", "締切日", "終了日", "期限"],
  id: ["ID", "タスクID"],
  outline: ["アウトライン", "階層"],
  progress: ["進捗率", "進捗"],
  situation: ["状況"],
  start: ["開始日"],
  status: ["ステータス", "状態"],
  title: ["タイトル", "タスク名"],
  type: ["タイプ", "種別"],
};

const brabioTaskImportColumns: TaskCsvColumn[] = [
  "id",
  "parentId",
  "type",
  "title",
  "status",
  "start",
  "end",
  "progress",
  "assignees",
  "effortHours",
  "dependencies",
];

const brabioTaskImportHeaders = brabioTaskImportColumns.map(
  (column) => taskCsvColumnLabels[column],
);

const brabioTaskImportMapping = Object.fromEntries(
  brabioTaskImportColumns.map((column, index) => [column, index]),
) as TaskCsvImportMapping;

const brabioMemberPalette = [
  "#675df6",
  "#ff7a8a",
  "#35b979",
  "#2f80ed",
  "#8b70f6",
  "#0ea5a3",
  "#f7933d",
  "#64748b",
];

function findBrabioHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const normalized = new Set(row.map((cell) => normalizeCsvHeader(String(cell))));
    return (
      normalized.has(normalizeCsvHeader("タイプ")) &&
      normalized.has(normalizeCsvHeader("アウトライン")) &&
      normalized.has(normalizeCsvHeader("タイトル"))
    );
  });
}

function getBrabioColumns(header: string[]) {
  const columns = {} as Record<BrabioColumnKey, number>;
  const normalizedHeader = header.map(normalizeCsvHeader);
  (Object.keys(brabioColumnAliases) as BrabioColumnKey[]).forEach((key) => {
    const index = brabioColumnAliases[key]
      .map(normalizeCsvHeader)
      .map((alias) => normalizedHeader.indexOf(alias))
      .find((candidate) => candidate >= 0);
    if (index != null && index >= 0) {
      columns[key] = index;
    }
  });

  (["type", "outline", "id", "title"] as BrabioColumnKey[]).forEach((key) => {
    if (columns[key] == null) {
      throw new ProjectImportError(
        `Brabio XLSXに必要な列がありません: ${brabioColumnAliases[key][0]}`,
      );
    }
  });

  return columns;
}

function readBrabioRow(
  row: unknown[],
  rowNumber: number,
  columns: Record<BrabioColumnKey, number>,
): BrabioRawTaskRow | null {
  const type = readBrabioCell(row, columns.type);
  const title = readBrabioCell(row, columns.title);
  if (!type || !title) {
    return null;
  }
  const outline = readBrabioOutline(readBrabioCell(row, columns.outline), rowNumber);

  return {
    assigneeIds: splitBrabioList(readBrabioCell(row, columns.assigneeIds)),
    assignees: splitBrabioList(readBrabioCell(row, columns.assignees)),
    completedAt: readBrabioDateCell(row[columns.completedAt]),
    end: readBrabioDateCell(row[columns.end]),
    id: readBrabioCell(row, columns.id) || `row-${rowNumber}`,
    outline,
    progress: readBrabioProgress(readBrabioCell(row, columns.progress)),
    rowNumber,
    situation: readBrabioCell(row, columns.situation),
    start: readBrabioDateCell(row[columns.start]),
    status: readBrabioCell(row, columns.status),
    title,
    type,
  };
}

function readBrabioCell(row: unknown[], index: number | undefined) {
  if (index == null) {
    return "";
  }
  const value = row[index];
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return formatDateKey(value);
  }
  return String(value).trim();
}

function readBrabioOutline(value: string, rowNumber: number) {
  const outline = Number(value);
  if (!Number.isInteger(outline) || outline < 0) {
    throw new ProjectImportError(`Brabio XLSX ${rowNumber}行目のアウトラインが正しくありません。`);
  }
  return outline;
}

function readBrabioDateCell(value: unknown) {
  if (value == null || value === "") {
    return "";
  }
  if (value instanceof Date) {
    return formatDateKey(value);
  }
  const text = String(value).trim();
  if (!text) {
    return "";
  }
  const normalized = text
    .replaceAll("/", "-")
    .replaceAll(".", "-")
    .replace("年", "-")
    .replace("月", "-")
    .replace(/日$/, "");
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (!match) {
    return "";
  }
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readBrabioProgress(value: string) {
  if (!value) {
    return 0;
  }
  const parsed = Number(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? clampProgress(parsed) : 0;
}

function collectBrabioMembers(taskRows: BrabioRawTaskRow[]) {
  const membersByName = new Map<string, Member>();
  const warnings: string[] = [];
  taskRows.forEach((row) => {
    row.assignees.forEach((name, index) => {
      if (membersByName.has(name)) {
        return;
      }
      const brabioId = row.assigneeIds[index] ?? "";
      const id = createBrabioMemberId(name, brabioId, membersByName.size + 1);
      membersByName.set(name, {
        capacityHours: 40,
        color: brabioMemberPalette[membersByName.size % brabioMemberPalette.length],
        id,
        initials: createBrabioMemberInitials(name),
        name,
        role: "Brabio移行",
        status: "active",
      });
    });
    if (row.assigneeIds.length > row.assignees.length) {
      warnings.push(
        `${row.title} のメンバーID数がメンバー名数より多いため、余ったIDは無視しました。`,
      );
    }
  });
  return {
    memberIdByName: new Map([...membersByName].map(([name, member]) => [name, member.id])),
    members: [...membersByName.values()],
    warnings,
  };
}

function convertBrabioRowsToTaskRows(
  taskRows: BrabioRawTaskRow[],
  memberIdByName: Map<string, string>,
) {
  const taskIdsByOutline = new Map<number, string>();
  const resolvedRows: BrabioResolvedTaskRow[] = [];
  const warnings: string[] = [];
  const projectStart =
    taskRows
      .map((row) => row.start)
      .filter(Boolean)
      .toSorted()[0] ?? todayKey();
  const projectEnd =
    taskRows
      .map((row) => row.end || row.completedAt || row.start)
      .filter(Boolean)
      .toSorted()
      .at(-1) ?? projectStart;

  taskRows.forEach((row) => {
    const taskId = createBrabioTaskId(row.id);
    const taskType = readBrabioTaskType(row.type, row.outline);
    const parentId = row.outline === 0 ? null : (taskIdsByOutline.get(row.outline - 1) ?? null);
    let { start } = row;
    let { end } = row;
    if (!start && !end && row.completedAt) {
      start = row.completedAt;
      end = row.completedAt;
    }
    if (start && !end) {
      end = start;
    }
    if (!start && end) {
      start = end;
    }
    if (!start || !end) {
      const parent = parentId
        ? resolvedRows.find((candidate) => candidate.taskId === parentId)
        : null;
      start = parent?.start ?? projectStart;
      end = parent?.end ?? projectEnd;
      warnings.push(
        `${row.title} は開始日または〆切日が空のため、${start} - ${end} で補完しました。`,
      );
    }
    if (end < start) {
      warnings.push(`${row.title} の〆切日が開始日より前のため、開始日に合わせました。`);
      end = start;
    }

    taskIdsByOutline.set(row.outline, taskId);
    [...taskIdsByOutline.keys()]
      .filter((outline) => outline > row.outline)
      .forEach((outline) => taskIdsByOutline.delete(outline));

    resolvedRows.push({
      ...row,
      end,
      parentId,
      start,
      taskId,
      taskType,
    });
  });

  return {
    rows: resolvedRows.map((row) => {
      const assignees = row.assignees
        .map((name) => memberIdByName.get(name) ?? "")
        .filter(Boolean)
        .join("\n");
      return [
        row.taskId,
        row.parentId ?? "",
        row.taskType,
        row.title,
        readBrabioTaskStatus(row.status, row.situation, row.progress),
        row.start,
        row.end,
        String(row.progress),
        assignees,
        "",
        "",
      ];
    }),
    warnings,
  };
}

function readBrabioTaskType(type: string, outline: number): TaskType {
  const normalized = normalizeCsvToken(type);
  if (normalized === "project") {
    return "summary";
  }
  if (normalized === "folder") {
    return outline <= 1 ? "phase" : "summary";
  }
  if (normalized === "milestone" || normalized === "マイルストーン") {
    return "milestone";
  }
  return "task";
}

function readBrabioTaskStatus(status: string, situation: string, progress: number): TaskStatus {
  const normalized = normalizeCsvToken(status || situation);
  if (normalized.includes("完了") || progress >= 100) {
    return "done";
  }
  if (normalized.includes("遅") || normalized.includes("delay")) {
    return "delayed";
  }
  if (normalized.includes("着手") || normalized.includes("進行") || progress > 0) {
    return "inProgress";
  }
  return "notStarted";
}

function createBrabioTaskId(sourceId: string) {
  return `brabio-${sourceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function createBrabioMemberId(name: string, brabioId: string, fallbackIndex: number) {
  const source = brabioId || `${fallbackIndex}-${name}`;
  return `brabio-member-${source.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function createBrabioMemberInitials(name: string) {
  const compact = name.replace(/\s+/g, "");
  return (compact.slice(0, 2) || "BR").toUpperCase();
}

function splitBrabioList(value: string) {
  return value
    .split(/\r?\n|,|、|;|；|\//)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function parseTaskCsvRow(
  row: string[],
  rowNumber: number,
  columns: Partial<Record<TaskCsvColumn, number>>,
  memberLookup: Map<string, string>,
): ScheduleTask {
  const id = readCsvCell(row, columns, "id") || `csv-${rowNumber - 1}`;
  const title = readRequiredCsvCell(row, columns, "title", rowNumber);
  const type = readCsvTaskType(readCsvCell(row, columns, "type"), rowNumber);
  const start = readCsvDate(
    readRequiredCsvCell(row, columns, "start", rowNumber),
    rowNumber,
    "開始日",
  );
  const endValue = readRequiredCsvCell(row, columns, "end", rowNumber);
  const end = readCsvDate(endValue, rowNumber, "終了日");
  const status = readCsvTaskStatus(readCsvCell(row, columns, "status"), rowNumber);
  const progress = readCsvProgress(readCsvCell(row, columns, "progress"), status, rowNumber);
  const effortHours = readCsvOptionalNumber(
    readCsvCell(row, columns, "effortHours"),
    rowNumber,
    "工数",
  );
  const assigneeIds = uniqueStrings(
    splitCsvList(readCsvCell(row, columns, "assignees")).map(
      (token) => memberLookup.get(normalizeLookupToken(token)) ?? token,
    ),
  );
  const dependencies = uniqueStrings(splitCsvList(readCsvCell(row, columns, "dependencies")));

  return {
    assigneeIds,
    color: getTaskCsvColor(type, rowNumber),
    dependencies,
    effortHours,
    end,
    expanded: type === "summary" || type === "phase" ? true : undefined,
    id,
    parentId: readCsvCell(row, columns, "parentId") || null,
    progress,
    start,
    status,
    title,
    type,
  };
}

function parseCsvRows(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let cellTouched = false;
  let inQuotes = false;

  function pushCell() {
    row.push(cell);
    cell = "";
    cellTouched = false;
  }

  function pushRow() {
    pushCell();
    if (!isBlankCsvRow(row)) {
      rows.push(row);
    }
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      cellTouched = true;
      continue;
    }

    if (char === '"' && !cellTouched && cell === "") {
      inQuotes = true;
      cellTouched = true;
      continue;
    }
    if (char === ",") {
      pushCell();
      continue;
    }
    if (char === "\r" || char === "\n") {
      pushRow();
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    cell += char;
    cellTouched = true;
  }

  if (inQuotes) {
    throw new ProjectImportError("CSVの引用符が閉じていません。");
  }
  if (cellTouched || cell.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function buildTaskCsvColumns(headerRow: string[]): Partial<Record<TaskCsvColumn, number>> {
  const normalizedAliases = Object.fromEntries(
    Object.entries(taskCsvHeaderAliases).map(([column, aliases]) => [
      column,
      new Set(aliases.map(normalizeCsvHeader)),
    ]),
  ) as Record<TaskCsvColumn, Set<string>>;
  const columns: Partial<Record<TaskCsvColumn, number>> = {};

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalizeCsvHeader(header);
    (Object.keys(normalizedAliases) as TaskCsvColumn[]).forEach((column) => {
      if (columns[column] == null && normalizedAliases[column].has(normalizedHeader)) {
        columns[column] = index;
      }
    });
  });

  return columns;
}

function readCsvCell(
  row: string[],
  columns: Partial<Record<TaskCsvColumn, number>>,
  column: TaskCsvColumn,
) {
  const index = columns[column];
  return index == null ? "" : (row[index] ?? "").trim();
}

function normalizeTaskCsvMapping(mapping: TaskCsvImportMapping) {
  return Object.fromEntries(
    Object.entries(mapping).filter(([, index]) => index != null && index >= 0),
  ) as TaskCsvImportMapping;
}

function readRequiredCsvCell(
  row: string[],
  columns: Partial<Record<TaskCsvColumn, number>>,
  column: TaskCsvColumn,
  rowNumber: number,
) {
  const value = readCsvCell(row, columns, column);
  if (value === "") {
    throw new ProjectImportError(`CSV ${rowNumber}行目の${taskCsvColumnLabels[column]}が空です。`);
  }
  return value;
}

function readCsvDate(value: string, rowNumber: number, label: string) {
  const normalized = value
    .trim()
    .replaceAll("/", "-")
    .replaceAll(".", "-")
    .replace("年", "-")
    .replace("月", "-")
    .replace(/日$/, "");
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (!match) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の${label}はYYYY-MM-DD形式にしてください。`);
  }
  const [, year, month, day] = match;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!isValidDateKey(date)) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の${label}が実在しません。`);
  }
  return date;
}

function readCsvTaskStatus(value: string, rowNumber: number): TaskStatus {
  if (value === "") {
    return "notStarted";
  }
  const status = taskCsvStatusMap[normalizeCsvToken(value)];
  if (!status) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の状態が正しくありません。`);
  }
  return status;
}

function readCsvTaskType(value: string, rowNumber: number): TaskType {
  if (value === "") {
    return "task";
  }
  const type = taskCsvTypeMap[normalizeCsvToken(value)];
  if (!type) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の種別が正しくありません。`);
  }
  return type;
}

function readCsvProgress(value: string, status: TaskStatus, rowNumber: number) {
  if (value === "") {
    return status === "done" ? 100 : 0;
  }
  const parsed = Number(value.replace("%", "").trim());
  if (!Number.isFinite(parsed)) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の進捗は数値にしてください。`);
  }
  return clampProgress(parsed);
}

function readCsvOptionalNumber(value: string, rowNumber: number, label: string) {
  if (value === "") {
    return undefined;
  }
  const parsed = Number(
    value.replaceAll(",", "").replace(/[hH]/g, "").replaceAll("時間", "").trim(),
  );
  if (!Number.isFinite(parsed)) {
    throw new ProjectImportError(`CSV ${rowNumber}行目の${label}は数値にしてください。`);
  }
  return parsed;
}

function splitCsvList(value: string) {
  return value
    .split(/[/,、;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createMemberLookup(members: Member[]) {
  const lookup = new Map<string, string>();
  members.forEach((member) => {
    [member.id, member.name, member.initials].forEach((value) => {
      lookup.set(normalizeLookupToken(value), member.id);
    });
  });
  return lookup;
}

function getTaskCsvColor(type: TaskType, rowNumber: number) {
  if (type !== "task") {
    return taskCsvTypeColors[type];
  }
  return taskCsvPalette[(rowNumber - 2) % taskCsvPalette.length];
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function normalizeCsvToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function normalizeLookupToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isBlankCsvRow(row: string[]) {
  return row.every((cell) => cell.trim() === "");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function parseCalendar(value: unknown): CalendarDefinition {
  const record = assertRecord(value, "calendar");
  const workWeek = readArray(record.workWeek, "calendar.workWeek");
  if (
    !workWeek.every(
      (day): day is number =>
        typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
    )
  ) {
    throw new ProjectImportError("稼働日の形式が正しくありません。");
  }

  return {
    holidays: readArray(record.holidays, "calendar.holidays").map(parseHoliday),
    id: readString(record.id, "calendar.id"),
    name: readString(record.name, "calendar.name"),
    workWeek,
  };
}

function parseHoliday(value: unknown) {
  const record = assertRecord(value, "holiday");
  return {
    date: readDate(record.date, "holiday.date"),
    name: readString(record.name, "holiday.name"),
  };
}

function parseMember(value: unknown): Member {
  const record = assertRecord(value, "member");
  return {
    availabilityOverrides:
      record.availabilityOverrides == null
        ? undefined
        : readArray(record.availabilityOverrides, "member.availabilityOverrides").map(
            parseMemberAvailabilityOverride,
          ),
    capacityHours: readNumber(record.capacityHours, "member.capacityHours"),
    color: readString(record.color, "member.color"),
    id: readString(record.id, "member.id"),
    inactiveAt:
      record.inactiveAt == null ? undefined : readString(record.inactiveAt, "member.inactiveAt"),
    initials: readString(record.initials, "member.initials"),
    name: readString(record.name, "member.name"),
    role: readString(record.role, "member.role"),
    status: record.status == null ? undefined : readMemberStatus(record.status, "member.status"),
  };
}

function parseMemberAvailabilityOverride(value: unknown): MemberAvailabilityOverride {
  const record = assertRecord(value, "member.availabilityOverride");
  return {
    date: readDate(record.date, "member.availabilityOverride.date"),
    id: readString(record.id, "member.availabilityOverride.id"),
    label: readString(record.label, "member.availabilityOverride.label"),
    type: readMemberAvailabilityOverrideType(record.type, "member.availabilityOverride.type"),
  };
}

function parseTeam(value: unknown): Team {
  const record = assertRecord(value, "team");
  return {
    code: readString(record.code, "team.code"),
    description: readString(record.description, "team.description"),
    id: readString(record.id, "team.id"),
    memberIds: readArray(record.memberIds, "team.memberIds").map((id) =>
      readString(id, "team.memberIds"),
    ),
    name: readString(record.name, "team.name"),
  };
}

function parseProject(value: unknown): Project {
  const record = assertRecord(value, "project");
  const nextMilestone = assertRecord(record.nextMilestone, "project.nextMilestone");
  return {
    archivedAt:
      record.archivedAt == null ? undefined : readString(record.archivedAt, "project.archivedAt"),
    id: readString(record.id, "project.id"),
    assignments:
      record.assignments == null
        ? undefined
        : readArray(record.assignments, "project.assignments").map(parseProjectAssignment),
    lifecycleStatus:
      record.lifecycleStatus == null
        ? undefined
        : readProjectLifecycleStatus(record.lifecycleStatus, "project.lifecycleStatus"),
    memberIds:
      record.memberIds == null
        ? undefined
        : readArray(record.memberIds, "project.memberIds").map((id) =>
            readString(id, "project.memberIds"),
          ),
    name: readString(record.name, "project.name"),
    projectNo:
      record.projectNo == null ? undefined : readString(record.projectNo, "project.projectNo"),
    nextMilestone: {
      date: readDate(nextMilestone.date, "project.nextMilestone.date"),
      title: readString(nextMilestone.title, "project.nextMilestone.title"),
    },
    rangeEnd: readDate(record.rangeEnd, "project.rangeEnd"),
    rangeStart: readDate(record.rangeStart, "project.rangeStart"),
    status: record.status == null ? undefined : readProjectStatus(record.status, "project.status"),
    staffingDemands:
      record.staffingDemands == null
        ? undefined
        : readArray(record.staffingDemands, "project.staffingDemands").map(parseStaffingDemand),
    teamId: readString(record.teamId, "project.teamId"),
    workspace: readString(record.workspace, "project.workspace"),
  };
}

function parseProjectAssignment(value: unknown): ProjectAssignment {
  const record = assertRecord(value, "project.assignment");
  const status = readString(record.status, "project.assignment.status");
  if (status !== "draft" && status !== "confirmed") {
    throw new ProjectImportError("project.assignment.status の値が正しくありません。");
  }
  return {
    allocationPercent: readNumber(record.allocationPercent, "project.assignment.allocationPercent"),
    endDate: readDate(record.endDate, "project.assignment.endDate"),
    id: readString(record.id, "project.assignment.id"),
    memberId: readString(record.memberId, "project.assignment.memberId"),
    role: readString(record.role, "project.assignment.role"),
    startDate: readDate(record.startDate, "project.assignment.startDate"),
    status,
  };
}

function parseStaffingDemand(value: unknown): StaffingDemand {
  const record = assertRecord(value, "project.staffingDemand");
  const status = readString(record.status, "project.staffingDemand.status");
  if (status !== "open" && status !== "filled") {
    throw new ProjectImportError("project.staffingDemand.status の値が正しくありません。");
  }
  return {
    allocationPercent: readNumber(
      record.allocationPercent,
      "project.staffingDemand.allocationPercent",
    ),
    endDate: readDate(record.endDate, "project.staffingDemand.endDate"),
    id: readString(record.id, "project.staffingDemand.id"),
    requiredCount: readNumber(record.requiredCount, "project.staffingDemand.requiredCount"),
    role: readString(record.role, "project.staffingDemand.role"),
    startDate: readDate(record.startDate, "project.staffingDemand.startDate"),
    status,
  };
}

function readProjectStatus(value: unknown, label: string) {
  if (value === "active" || value === "archived") {
    return value;
  }
  throw new ProjectImportError(`${label} の値が正しくありません。`);
}

function readProjectLifecycleStatus(value: unknown, label: string): ProjectLifecycleStatus {
  if (value === "planning" || value === "inProgress" || value === "completed") {
    return value;
  }
  throw new ProjectImportError(`${label} の値が正しくありません。`);
}

function readMemberStatus(value: unknown, label: string): MemberStatus {
  if (value === "active" || value === "inactive") {
    return value;
  }
  throw new ProjectImportError(`${label} の値が正しくありません。`);
}

function readMemberAvailabilityOverrideType(
  value: unknown,
  label: string,
): MemberAvailabilityOverrideType {
  if (value === "unavailable") {
    return value;
  }
  throw new ProjectImportError(`${label} の値が正しくありません。`);
}

function readProjectIssuePriority(value: unknown): ProjectIssuePriority {
  if (value === "critical" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  throw new ProjectImportError("issues.priority の値が正しくありません。");
}

function readProjectIssueStatus(value: unknown): ProjectIssueStatus {
  if (
    value === "open" ||
    value === "inProgress" ||
    value === "blocked" ||
    value === "resolved" ||
    value === "closed"
  ) {
    return value;
  }
  throw new ProjectImportError("issues.status の値が正しくありません。");
}

function readProjectIssueType(value: unknown): ProjectIssueType {
  if (
    value === "bug" ||
    value === "change" ||
    value === "question" ||
    value === "risk" ||
    value === "task"
  ) {
    return value;
  }
  throw new ProjectImportError("issues.type の値が正しくありません。");
}

function readWorkLogCategory(value: unknown) {
  if (
    value === "improvement" ||
    value === "incident" ||
    value === "maintenance" ||
    value === "meeting" ||
    value === "other" ||
    value === "support"
  ) {
    return value;
  }
  throw new ProjectImportError("workLogs.category の値が正しくありません。");
}

function parseTask(value: unknown): ScheduleTask {
  const record = assertRecord(value, "task");
  const parentId = record.parentId == null ? null : readString(record.parentId, "task.parentId");
  const dependencies =
    record.dependencies == null
      ? undefined
      : readArray(record.dependencies, "task.dependencies").map((id) =>
          readString(id, "task.dependencies"),
        );
  const assigneeAllocations =
    record.assigneeAllocations == null
      ? undefined
      : readArray(record.assigneeAllocations, "task.assigneeAllocations").map(
          parseTaskAssigneeAllocation,
        );
  const effortHours =
    record.effortHours == null ? undefined : readNumber(record.effortHours, "task.effortHours");
  const expanded =
    record.expanded == null ? undefined : readBoolean(record.expanded, "task.expanded");
  const description =
    record.description == null ? undefined : readString(record.description, "task.description");
  const baselineStart =
    record.baselineStart == null ? undefined : readDate(record.baselineStart, "task.baselineStart");
  const baselineEnd =
    record.baselineEnd == null ? undefined : readDate(record.baselineEnd, "task.baselineEnd");
  const baselineCapturedAt =
    record.baselineCapturedAt == null
      ? undefined
      : readString(record.baselineCapturedAt, "task.baselineCapturedAt");
  const checklist =
    record.checklist == null
      ? undefined
      : readArray(record.checklist, "task.checklist").map(parseTaskChecklistItem);
  const comments =
    record.comments == null
      ? undefined
      : readArray(record.comments, "task.comments").map(parseTaskComment);
  const links =
    record.links == null
      ? undefined
      : readArray(record.links, "task.links").map(parseTaskReferenceLink);

  return {
    assigneeAllocations,
    assigneeIds: readArray(record.assigneeIds, "task.assigneeIds").map((id) =>
      readString(id, "task.assigneeIds"),
    ),
    baselineCapturedAt,
    baselineEnd,
    baselineStart,
    checklist,
    color: readString(record.color, "task.color"),
    comments,
    dependencies,
    description,
    effortHours,
    end: readDate(record.end, "task.end"),
    expanded,
    id: readString(record.id, "task.id"),
    links,
    parentId,
    progress: clampProgress(readNumber(record.progress, "task.progress")),
    start: readDate(record.start, "task.start"),
    status: readTaskStatus(record.status),
    title: readString(record.title, "task.title"),
    type: readTaskType(record.type),
  };
}

function parseTaskAssigneeAllocation(value: unknown): TaskAssigneeAllocation {
  const record = assertRecord(value, "task.assigneeAllocations");
  return {
    memberId: readString(record.memberId, "task.assigneeAllocations.memberId"),
    percent: readNumber(record.percent, "task.assigneeAllocations.percent"),
  };
}

function parseTaskChecklistItem(value: unknown): TaskChecklistItem {
  const record = assertRecord(value, "task.checklist");
  return {
    done: readBoolean(record.done, "task.checklist.done"),
    id: readString(record.id, "task.checklist.id"),
    label: readString(record.label, "task.checklist.label"),
  };
}

function parseTaskComment(value: unknown): TaskComment {
  const record = assertRecord(value, "task.comments");
  return {
    author: readString(record.author, "task.comments.author"),
    body: readString(record.body, "task.comments.body"),
    createdAt: readString(record.createdAt, "task.comments.createdAt"),
    id: readString(record.id, "task.comments.id"),
  };
}

function parseTaskReferenceLink(value: unknown): TaskReferenceLink {
  const record = assertRecord(value, "task.links");
  return {
    createdAt: readString(record.createdAt, "task.links.createdAt"),
    id: readString(record.id, "task.links.id"),
    label: readString(record.label, "task.links.label"),
    url: readString(record.url, "task.links.url"),
  };
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectImportError(`${label} の形式が正しくありません。`);
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProjectImportError(`${label} は配列である必要があります。`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ProjectImportError(`${label} はtrue/falseである必要があります。`);
  }
  return value;
}

function readDate(value: unknown, label: string): string {
  const date = readString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ProjectImportError(`${label} はYYYY-MM-DD形式である必要があります。`);
  }
  return date;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProjectImportError(`${label} は数値である必要があります。`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProjectImportError(`${label} は文字列である必要があります。`);
  }
  return value;
}

function readTaskStatus(value: unknown): TaskStatus {
  if (value === "notStarted" || value === "inProgress" || value === "done" || value === "delayed") {
    return value;
  }
  throw new ProjectImportError("task.status の値が正しくありません。");
}

function readTaskType(value: unknown): TaskType {
  if (value === "summary" || value === "phase" || value === "task" || value === "milestone") {
    return value;
  }
  throw new ProjectImportError("task.type の値が正しくありません。");
}

function clampProgress(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function findDependencyCycles(tasks: ScheduleTask[]) {
  return findCycles(tasks, (task) => task.dependencies ?? []);
}

function findParentCycles(tasks: ScheduleTask[]) {
  return findCycles(tasks, (task) => (task.parentId ? [task.parentId] : []));
}

function findCycles(tasks: ScheduleTask[], getNextIds: (task: ScheduleTask) => string[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclicTitles = new Set<string>();

  function visit(task: ScheduleTask) {
    if (visiting.has(task.id)) {
      cyclicTitles.add(task.title);
      return;
    }
    if (visited.has(task.id)) {
      return;
    }

    visiting.add(task.id);
    getNextIds(task).forEach((nextId) => {
      const nextTask = taskById.get(nextId);
      if (nextTask) {
        visit(nextTask);
      }
    });
    visiting.delete(task.id);
    visited.add(task.id);
  }

  tasks.forEach(visit);
  return [...cyclicTitles];
}

function getDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }
    seen.add(value);
  });
  return [...duplicates];
}

function isValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}
