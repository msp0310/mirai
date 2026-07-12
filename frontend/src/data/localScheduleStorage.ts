import { normalizeResourceDisplaySettings } from "../lib/resourceDisplaySettings";
import type {
  AppViewTab,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  ResourceDisplaySettings,
  ResourceScope,
  ScheduleFilters,
} from "../types/schedule";
export type LocalSchedulePreferences = {
  activeProjectId: string;
  activeTab: AppViewTab;
  activeTeamId: string;
  calendarAware: boolean;
  columnVisibility: GanttColumnVisibility;
  collapsedIdsByProject: Record<string, string[]>;
  favoriteProjectIds: string[];
  filterOpen: boolean;
  filters: ScheduleFilters;
  resourceDisplaySettings: ResourceDisplaySettings;
  resourceScope: ResourceScope;
  scale: GanttScale;
  timeUnit: GanttTimeUnit;
};

export type LocalScheduleDraft = LocalSchedulePreferences & {
  savedAt: string;
  version: 1 | 2;
};

const localScheduleDraftKey = "si-schedule-manager-draft-v1";
const localScheduleDraftVersion = 2;

/** 端末に保存した表示設定を、旧バージョンを含めて安全に読み込みます。 */
export function loadLocalScheduleDraft(): LocalScheduleDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(localScheduleDraftKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<LocalScheduleDraft>;
    if (!isLocalScheduleDraft(parsed)) {
      return null;
    }
    const draft: LocalScheduleDraft = {
      activeProjectId: parsed.activeProjectId,
      activeTab: isAppViewTab(parsed.activeTab) ? parsed.activeTab : "Projects",
      activeTeamId: parsed.activeTeamId,
      calendarAware: parsed.calendarAware,
      columnVisibility: normalizeColumnVisibility(
        parsed.version === 1
          ? migrateVersion1ColumnVisibility(parsed.columnVisibility)
          : parsed.columnVisibility,
      ),
      collapsedIdsByProject: normalizeCollapsedIdsByProject(parsed.collapsedIdsByProject),
      filterOpen: typeof parsed.filterOpen === "boolean" ? parsed.filterOpen : true,
      filters: normalizeScheduleFilters(parsed.filters),
      favoriteProjectIds: parsed.favoriteProjectIds,
      resourceDisplaySettings: normalizeResourceDisplaySettings(parsed.resourceDisplaySettings),
      resourceScope: isResourceScope(parsed.resourceScope) ? parsed.resourceScope : "project",
      savedAt: parsed.savedAt,
      scale: parsed.scale,
      timeUnit: parsed.timeUnit,
      version: parsed.version,
    };
    // 旧版は案件データ一式を保存していたため、読み込み時に表示設定だけへ縮小します。
    saveLocalScheduleDraft(draft);
    return draft;
  } catch {
    return null;
  }
}

/** 案件データを含めず、画面の表示設定だけを端末へ保存します。 */
export function saveLocalScheduleDraft(draft: LocalSchedulePreferences) {
  const savedAt = new Date().toISOString();
  const payload: LocalScheduleDraft = {
    activeProjectId: draft.activeProjectId,
    activeTab: draft.activeTab,
    activeTeamId: draft.activeTeamId,
    calendarAware: draft.calendarAware,
    columnVisibility: draft.columnVisibility,
    collapsedIdsByProject: draft.collapsedIdsByProject,
    favoriteProjectIds: draft.favoriteProjectIds,
    filterOpen: draft.filterOpen,
    filters: draft.filters,
    resourceDisplaySettings: draft.resourceDisplaySettings,
    resourceScope: draft.resourceScope,
    savedAt,
    scale: draft.scale,
    timeUnit: draft.timeUnit,
    version: localScheduleDraftVersion,
  };
  window.localStorage.setItem(localScheduleDraftKey, JSON.stringify(payload));
  return payload;
}

/** ログアウトや再初期化の際に、端末へ残した表示設定を破棄します。 */
export function clearLocalScheduleDraft() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(localScheduleDraftKey);
}

function isLocalScheduleDraft(value: Partial<LocalScheduleDraft>): value is LocalScheduleDraft {
  return (
    (value.version === 1 || value.version === 2) &&
    typeof value.savedAt === "string" &&
    typeof value.activeTeamId === "string" &&
    typeof value.activeProjectId === "string" &&
    (value.activeTab === undefined || isAppViewTab(value.activeTab)) &&
    typeof value.calendarAware === "boolean" &&
    (value.columnVisibility === undefined || isGanttColumnVisibility(value.columnVisibility)) &&
    (value.collapsedIdsByProject === undefined ||
      isCollapsedIdsByProject(value.collapsedIdsByProject)) &&
    (value.filterOpen === undefined || typeof value.filterOpen === "boolean") &&
    (value.filters === undefined || isScheduleFilters(value.filters)) &&
    (value.resourceScope === undefined || isResourceScope(value.resourceScope)) &&
    isGanttScale(value.scale) &&
    isGanttTimeUnit(value.timeUnit) &&
    Array.isArray(value.favoriteProjectIds)
  );
}

function normalizeScheduleFilters(value: unknown): ScheduleFilters {
  if (isScheduleFilters(value)) {
    return value;
  }
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
  if (!isCollapsedIdsByProject(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, taskIds]) => [projectId, [...new Set(taskIds)].toSorted()])
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
  if (value == null || typeof value !== "object") {
    return false;
  }
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

function migrateVersion1ColumnVisibility(value: unknown): unknown {
  if (!isGanttColumnVisibility(value)) {
    return value;
  }
  return {
    ...value,
    assignee: false,
  };
}

function normalizeColumnVisibility(value: unknown): GanttColumnVisibility {
  if (isGanttColumnVisibility(value)) {
    return value;
  }
  return {
    assignee: false,
    progress: false,
    status: true,
  };
}

function isGanttColumnVisibility(value: unknown): value is GanttColumnVisibility {
  if (value == null || typeof value !== "object") {
    return false;
  }
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
    value === "PersonalAnalytics" ||
    value === "Resource" ||
    value === "Calendar" ||
    value === "Milestones" ||
    value === "Activity"
  );
}

function isResourceScope(value: unknown): value is ResourceScope {
  return value === "project" || value === "team";
}
