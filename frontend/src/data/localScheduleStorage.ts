import type {
  ActivityLogEntry,
  AppViewTab,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  ResourceDisplaySettings,
  ResourceScope,
  ScheduleFilters,
} from "../types/schedule";
import { normalizeResourceDisplaySettings } from "../lib/resourceDisplaySettings";
import type { ScheduleWorkspace } from "./scheduleRepository";

export type LocalScheduleDraft = {
  activeProjectId: string;
  activeTab: AppViewTab;
  activeTeamId: string;
  activityLogs: Record<string, ActivityLogEntry[]>;
  calendarAware: boolean;
  columnVisibility: GanttColumnVisibility;
  collapsedIdsByProject: Record<string, string[]>;
  favoriteProjectIds: string[];
  filterOpen: boolean;
  filters: ScheduleFilters;
  resourceDisplaySettings: ResourceDisplaySettings;
  resourceScope: ResourceScope;
  savedAt: string;
  scale: GanttScale;
  timeUnit: GanttTimeUnit;
  version: 1 | 2;
  workspace: ScheduleWorkspace;
};

const localScheduleDraftKey = "si-schedule-manager-draft-v1";
const localScheduleDraftVersion = 2;

/** loadLocalScheduleDraftを実行し、アプリケーション用の値を返します。 */
export function loadLocalScheduleDraft(): LocalScheduleDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localScheduleDraftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalScheduleDraft>;
    if (!isLocalScheduleDraft(parsed)) return null;
    return {
      ...parsed,
      activeTab: isAppViewTab(parsed.activeTab) ? parsed.activeTab : "Projects",
      activityLogs: normalizeActivityLogs(parsed.activityLogs),
      columnVisibility: normalizeColumnVisibility(
        parsed.version === 1
          ? migrateVersion1ColumnVisibility(parsed.columnVisibility)
          : parsed.columnVisibility,
      ),
      collapsedIdsByProject: normalizeCollapsedIdsByProject(parsed.collapsedIdsByProject),
      filterOpen: typeof parsed.filterOpen === "boolean" ? parsed.filterOpen : true,
      filters: normalizeScheduleFilters(parsed.filters),
      resourceDisplaySettings: normalizeResourceDisplaySettings(parsed.resourceDisplaySettings),
      resourceScope: isResourceScope(parsed.resourceScope) ? parsed.resourceScope : "project",
    };
  } catch {
    return null;
  }
}

/** saveLocalScheduleDraftを実行し、アプリケーション用の値を返します。 */
export function saveLocalScheduleDraft(draft: Omit<LocalScheduleDraft, "savedAt" | "version">) {
  const savedAt = new Date().toISOString();
  const payload: LocalScheduleDraft = {
    ...draft,
    savedAt,
    version: localScheduleDraftVersion,
  };
  window.localStorage.setItem(localScheduleDraftKey, JSON.stringify(payload));
  return payload;
}

/** clearLocalScheduleDraftを実行し、アプリケーション用の値を返します。 */
export function clearLocalScheduleDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(localScheduleDraftKey);
}

function isLocalScheduleDraft(value: Partial<LocalScheduleDraft>): value is LocalScheduleDraft {
  return (
    (value.version === 1 || value.version === 2) &&
    typeof value.savedAt === "string" &&
    typeof value.activeTeamId === "string" &&
    typeof value.activeProjectId === "string" &&
    (value.activeTab === undefined || isAppViewTab(value.activeTab)) &&
    (value.activityLogs === undefined || isActivityLogs(value.activityLogs)) &&
    typeof value.calendarAware === "boolean" &&
    (value.columnVisibility === undefined || isGanttColumnVisibility(value.columnVisibility)) &&
    (value.collapsedIdsByProject === undefined ||
      isCollapsedIdsByProject(value.collapsedIdsByProject)) &&
    (value.filterOpen === undefined || typeof value.filterOpen === "boolean") &&
    (value.filters === undefined || isScheduleFilters(value.filters)) &&
    (value.resourceScope === undefined || isResourceScope(value.resourceScope)) &&
    isGanttScale(value.scale) &&
    isGanttTimeUnit(value.timeUnit) &&
    Array.isArray(value.favoriteProjectIds) &&
    value.workspace != null &&
    Array.isArray(value.workspace.schedules) &&
    Array.isArray(value.workspace.teams)
  );
}

function normalizeActivityLogs(value: unknown): Record<string, ActivityLogEntry[]> {
  if (isActivityLogs(value)) return value;
  return {};
}

function isActivityLogs(value: unknown): value is Record<string, ActivityLogEntry[]> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (entries) => Array.isArray(entries) && entries.every(isActivityLogEntry),
  );
}

function isActivityLogEntry(value: unknown): value is ActivityLogEntry {
  if (value == null || typeof value !== "object") return false;
  const maybe = value as Partial<ActivityLogEntry>;
  return (
    typeof maybe.actor === "string" &&
    isActivityCategory(maybe.category) &&
    typeof maybe.detail === "string" &&
    typeof maybe.happenedAt === "string" &&
    typeof maybe.id === "string" &&
    typeof maybe.projectId === "string" &&
    (maybe.taskId === undefined || typeof maybe.taskId === "string") &&
    typeof maybe.title === "string" &&
    isActivityTone(maybe.tone)
  );
}

function isActivityCategory(value: unknown) {
  return (
    value === "calendar" ||
    value === "import" ||
    value === "issue" ||
    value === "project" ||
    value === "sync" ||
    value === "task" ||
    value === "team" ||
    value === "workLog"
  );
}

function normalizeScheduleFilters(value: unknown): ScheduleFilters {
  if (isScheduleFilters(value)) return value;
  return {
    assigneeId: "all",
    query: "",
    statuses: {
      delayed: true,
      done: true,
      inProgress: true,
      notStarted: true,
    },
  };
}

function normalizeCollapsedIdsByProject(value: unknown): Record<string, string[]> {
  if (!isCollapsedIdsByProject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, taskIds]) => [projectId, [...new Set(taskIds)].sort()])
      .filter(([, taskIds]) => taskIds.length > 0),
  );
}

function isCollapsedIdsByProject(value: unknown): value is Record<string, string[]> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([projectId, taskIds]) =>
      typeof projectId === "string" &&
      Array.isArray(taskIds) &&
      taskIds.every((taskId) => typeof taskId === "string"),
  );
}

function isScheduleFilters(value: unknown): value is ScheduleFilters {
  if (value == null || typeof value !== "object") return false;
  const maybe = value as Partial<ScheduleFilters>;
  return (
    typeof maybe.assigneeId === "string" &&
    typeof maybe.query === "string" &&
    maybe.statuses != null &&
    typeof maybe.statuses === "object" &&
    typeof maybe.statuses.delayed === "boolean" &&
    typeof maybe.statuses.done === "boolean" &&
    typeof maybe.statuses.inProgress === "boolean" &&
    typeof maybe.statuses.notStarted === "boolean"
  );
}

function isActivityTone(value: unknown) {
  return value === "danger" || value === "info" || value === "success" || value === "warning";
}

function migrateVersion1ColumnVisibility(value: unknown): unknown {
  if (!isGanttColumnVisibility(value)) return value;
  return {
    ...value,
    assignee: false,
  };
}

function normalizeColumnVisibility(value: unknown): GanttColumnVisibility {
  if (isGanttColumnVisibility(value)) return value;
  return {
    assignee: false,
    progress: false,
    status: true,
  };
}

function isGanttColumnVisibility(value: unknown): value is GanttColumnVisibility {
  if (value == null || typeof value !== "object") return false;
  const maybe = value as Partial<GanttColumnVisibility>;
  return (
    typeof maybe.assignee === "boolean" &&
    typeof maybe.status === "boolean" &&
    typeof maybe.progress === "boolean"
  );
}

function isGanttScale(value: unknown): value is GanttScale {
  return value === "compact" || value === "normal" || value === "comfortable";
}

function isGanttTimeUnit(value: unknown): value is GanttTimeUnit {
  return value === "day" || value === "week" || value === "month";
}

function isAppViewTab(value: unknown): value is AppViewTab {
  return (
    value === "Gantt" ||
    value === "Status" ||
    value === "Analysis" ||
    value === "WeeklyReport" ||
    value === "Projects" ||
    value === "Workload" ||
    value === "Issues" ||
    value === "WorkLogs" ||
    value === "DailyReports" ||
    value === "Resource" ||
    value === "Calendar" ||
    value === "Milestones" ||
    value === "Activity"
  );
}

function isResourceScope(value: unknown): value is ResourceScope {
  return value === "project" || value === "team";
}
