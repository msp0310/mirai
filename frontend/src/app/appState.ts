import type { ViewTab } from "../components/layout/ViewTabs";
import { loadLocalScheduleDraft } from "../data/localScheduleStorage";
import type { ScheduleWorkspace } from "../data/scheduleRepository";
import type { TaskHistory } from "../features/gantt/types/ganttState";
import type { ConfigChangeReview } from "../lib/changeReview";
import { isProjectArchived } from "../lib/projects";
import { defaultResourceDisplaySettings } from "../lib/resourceDisplaySettings";
import { addDays, parseDate, toDateKey } from "../lib/schedule";
import type { ScheduleHealthIssue } from "../lib/scheduleHealth";
import { normalizeSummaryTasks } from "../lib/taskOperations";
import type {
  ActivityLogEntry,
  GanttColumnVisibility,
  LocalDraftChangeSummary,
  Project,
  ScheduleFilters,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../types/schedule";
import type { AppInitialState, PersistableDraft } from "./appTypes";
import { getCompassRouteState, getProjectIdFromCurrentRoute } from "./routing/compassRouteState";

/** ローカル表示設定がない場合に使う既定のフィルター状態です。 */
export const initialFilters: ScheduleFilters = {
  query: "",
  assigneeId: "all",
  statuses: {
    notStarted: true,
    inProgress: true,
    done: true,
    delayed: true,
  },
};

/** タスク名の可読性を優先し、補助情報を任意表示にする既定列です。 */
export const defaultColumnVisibility: GanttColumnVisibility = {
  assignee: false,
  progress: false,
  status: true,
};

/** 過去の保存データを、現在の既定値を保ちながら正規化します。 */
export function normalizeColumnVisibility(
  visibility?: GanttColumnVisibility,
): GanttColumnVisibility {
  return { ...defaultColumnVisibility, ...visibility, progress: false };
}

/** ワークスペース内の各プロジェクトに独立したUndo/Redo履歴を作成します。 */
export function createTaskHistories(workspace: ScheduleWorkspace): Record<string, TaskHistory> {
  return Object.fromEntries(
    workspace.schedules.map((schedule) => [
      schedule.project.id,
      { future: [], past: [], present: normalizeSummaryTasks(schedule.tasks) },
    ]),
  );
}

/** 履歴を持たないプロジェクトのために最小限のアクティビティを作成します。 */
export function createInitialActivityLogs(
  workspace: ScheduleWorkspace,
  happenedAt = new Date().toISOString(),
): Record<string, ActivityLogEntry[]> {
  return Object.fromEntries(
    workspace.schedules.map((snapshot) => [
      snapshot.project.id,
      [
        {
          actor: "システム",
          category: "project",
          detail: `${snapshot.tasks.length}件のタスクを読み込みました。`,
          happenedAt,
          id: `${snapshot.project.id}-activity-initial`,
          projectId: snapshot.project.id,
          title: "プロジェクトを読み込みました",
          tone: "info",
        } satisfies ActivityLogEntry,
      ],
    ]),
  );
}

/** 古いバージョンで作成されたプロジェクトの不足アクティビティを補います。 */
export function ensureActivityLogs(
  workspace: ScheduleWorkspace,
  activityLogs: Record<string, ActivityLogEntry[]> | undefined,
): Record<string, ActivityLogEntry[]> {
  const defaults = createInitialActivityLogs(workspace);
  return Object.fromEntries(
    workspace.schedules.map((snapshot) => [
      snapshot.project.id,
      activityLogs?.[snapshot.project.id] ?? defaults[snapshot.project.id] ?? [],
    ]),
  );
}

/** 各保存スナップショットのタスクを、現在のUndo履歴の内容で置き換えます。 */
export function mergeWorkspaceTasks(
  workspace: ScheduleWorkspace,
  histories: Record<string, TaskHistory>,
): ScheduleWorkspace {
  return {
    ...workspace,
    schedules: workspace.schedules.map((snapshot) => ({
      ...snapshot,
      tasks: histories[snapshot.project.id]?.present ?? snapshot.tasks,
    })),
  };
}

/** タスクの日付範囲を返し、タスクがなければプロジェクト範囲を使います。 */
export function getTaskRange(tasks: ScheduleTask[], project: Project) {
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

/** 当初計画を残しつつ、期間外へタスクを動かせるガント表示範囲を返します。 */
export function getGanttTimelineRange(tasks: ScheduleTask[], project: Project) {
  const taskRange = getTaskRange(tasks, project) ?? {
    end: project.rangeEnd,
    start: project.rangeStart,
  };
  return {
    end: toDateKey(addDays(parseDate(taskRange.end), 42)),
    start: toDateKey(addDays(parseDate(taskRange.start), -14)),
  };
}

/** 未保存変更を判定するための安定した比較キーを生成します。 */
export function createDraftSignature(draft: PersistableDraft) {
  return JSON.stringify(draft);
}

/** 設定変更行から、保存前レビュー用の集約結果を作成します。 */
export function createConfigChangeReviewFromRows(
  rows: ConfigChangeReview["rows"],
): ConfigChangeReview {
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

/** 折りたたみ状態を決定的な順序で直列化し、比較コストを抑えます。 */
export function serializeCollapsedIdsByProject(
  value: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, taskIds]): [string, string[]] => [
        projectId,
        [...new Set(taskIds)].toSorted(),
      ])
      .filter(([, taskIds]) => taskIds.length > 0)
      .toSorted(([projectA], [projectB]) => projectA.localeCompare(projectB)),
  );
}

/** JSON互換の状態を比較し、呼び出し側に直列化の詳細を漏らしません。 */
export function areDraftValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** API送信前に、データ変更と表示変更を利用者向けに要約します。 */
export function createLocalDraftChangeSummary(
  currentDraft: PersistableDraft,
  savedDraft: PersistableDraft,
): LocalDraftChangeSummary {
  const changedProjectDataLabels = currentDraft.workspace.schedules.flatMap((currentSchedule) => {
    const savedSchedule = savedDraft.workspace.schedules.find(
      (schedule) => schedule.project.id === currentSchedule.project.id,
    );
    if (!savedSchedule) {
      return [];
    }
    return [
      !areDraftValuesEqual(currentSchedule.issues ?? [], savedSchedule.issues ?? [])
        ? "課題"
        : null,
      !areDraftValuesEqual(currentSchedule.workLogs ?? [], savedSchedule.workLogs ?? [])
        ? "作業時間"
        : null,
    ];
  });
  const labels = [
    currentDraft.activeProjectId !== savedDraft.activeProjectId ||
    currentDraft.activeTeamId !== savedDraft.activeTeamId
      ? "表示中プロジェクト"
      : null,
    currentDraft.activeTab !== savedDraft.activeTab ? "表示タブ" : null,
    !areDraftValuesEqual(currentDraft.filters, savedDraft.filters) ||
    currentDraft.filterOpen !== savedDraft.filterOpen ||
    !areDraftValuesEqual(currentDraft.collapsedIdsByProject, savedDraft.collapsedIdsByProject)
      ? "Ganttビュー"
      : null,
    currentDraft.calendarAware !== savedDraft.calendarAware ||
    currentDraft.scale !== savedDraft.scale ||
    currentDraft.timeUnit !== savedDraft.timeUnit ||
    !areDraftValuesEqual(currentDraft.columnVisibility, savedDraft.columnVisibility)
      ? "Gantt表示設定"
      : null,
    currentDraft.resourceScope !== savedDraft.resourceScope ||
    !areDraftValuesEqual(currentDraft.resourceDisplaySettings, savedDraft.resourceDisplaySettings)
      ? "Resource表示設定"
      : null,
    !areDraftValuesEqual(currentDraft.favoriteProjectIds, savedDraft.favoriteProjectIds)
      ? "お気に入り"
      : null,
    ...changedProjectDataLabels,
  ].filter((label): label is string => label !== null);

  return { count: labels.length, detail: labels.join(" / "), labels };
}

/** Reactの各状態から、保存対象となる唯一の正規ドラフトを作成します。 */
export function createPersistableDraft(input: {
  activeProjectId: string;
  activeTab: ViewTab;
  activeTeamId: string;
  activityLogs: Record<string, ActivityLogEntry[]>;
  calendarAware: boolean;
  columnVisibility: GanttColumnVisibility;
  collapsedIdsByProject: Record<string, string[]>;
  favoriteProjectIds: Set<string>;
  filterOpen: boolean;
  filters: ScheduleFilters;
  resourceDisplaySettings: PersistableDraft["resourceDisplaySettings"];
  resourceScope: PersistableDraft["resourceScope"];
  scale: PersistableDraft["scale"];
  taskHistories: Record<string, TaskHistory>;
  timeUnit: PersistableDraft["timeUnit"];
  workspace: ScheduleWorkspace;
}): PersistableDraft {
  return {
    activeProjectId: input.activeProjectId,
    activeTab: input.activeTab,
    activeTeamId: input.activeTeamId,
    activityLogs: input.activityLogs,
    calendarAware: input.calendarAware,
    columnVisibility: input.columnVisibility,
    collapsedIdsByProject: serializeCollapsedIdsByProject(input.collapsedIdsByProject),
    favoriteProjectIds: [...input.favoriteProjectIds].toSorted(),
    filterOpen: input.filterOpen,
    filters: input.filters,
    resourceDisplaySettings: input.resourceDisplaySettings,
    resourceScope: input.resourceScope,
    scale: input.scale,
    timeUnit: input.timeUnit,
    workspace: mergeWorkspaceTasks(input.workspace, input.taskHistories),
  };
}

/** APIデータ、ディープリンク、任意のローカル表示状態から安全な初期状態を作成します。 */
export function createInitialAppState(
  workspace: ScheduleWorkspace,
  draft = loadLocalScheduleDraft(),
): AppInitialState {
  if (workspace.schedules.length === 0) {
    throw new Error("APIからプロジェクトが取得できませんでした。");
  }
  const firstSchedule =
    workspace.schedules.find((snapshot) => !isProjectArchived(snapshot.project)) ??
    workspace.schedules[0];
  const routeState = getCompassRouteState(
    typeof window === "undefined" ? "/projects" : window.location.pathname,
  );
  const routeProjectId = getProjectIdFromCurrentRoute();
  const routeSchedule = routeProjectId
    ? (workspace.schedules.find(
        (snapshot) =>
          snapshot.project.id === routeProjectId && !isProjectArchived(snapshot.project),
      ) ?? null)
    : null;
  const hasDraftProject = workspace.schedules.some(
    (snapshot) =>
      snapshot.project.id === draft?.activeProjectId && !isProjectArchived(snapshot.project),
  );
  const draftSchedule = hasDraftProject
    ? (workspace.schedules.find((snapshot) => snapshot.project.id === draft?.activeProjectId) ??
      firstSchedule)
    : null;
  const activeSchedule = routeSchedule ?? draftSchedule ?? firstSchedule;
  const taskHistories = createTaskHistories(workspace);
  const activityLogs = ensureActivityLogs(workspace, undefined);
  const persistableDraft = createPersistableDraft({
    activeProjectId: activeSchedule.project.id,
    activeTab: routeState.activeTab,
    activeTeamId: activeSchedule.project.teamId ?? draft?.activeTeamId ?? "",
    activityLogs,
    calendarAware: draft?.calendarAware ?? true,
    columnVisibility: normalizeColumnVisibility(draft?.columnVisibility),
    collapsedIdsByProject: draft?.collapsedIdsByProject ?? {},
    favoriteProjectIds: new Set(draft?.favoriteProjectIds),
    // フィルターは作業領域を狭めるため、起動時は常に閉じます。
    filterOpen: false,
    filters: draft?.filters ?? initialFilters,
    resourceDisplaySettings: draft?.resourceDisplaySettings ?? defaultResourceDisplaySettings,
    resourceScope: draft?.resourceScope ?? "project",
    scale: draft?.scale ?? "normal",
    taskHistories,
    timeUnit: draft?.timeUnit ?? "day",
    workspace,
  });
  return {
    activeProjectId: persistableDraft.activeProjectId,
    activeTab: persistableDraft.activeTab,
    activeTeamId: persistableDraft.activeTeamId,
    activityLogs,
    calendarAware: persistableDraft.calendarAware,
    columnVisibility: persistableDraft.columnVisibility,
    collapsedIdsByProject: persistableDraft.collapsedIdsByProject,
    favoriteProjectIds: new Set(persistableDraft.favoriteProjectIds),
    filterOpen: persistableDraft.filterOpen,
    filters: persistableDraft.filters,
    routeProjectId,
    routeProjectMatched: routeSchedule !== null,
    resourceDisplaySettings: persistableDraft.resourceDisplaySettings,
    resourceScope: persistableDraft.resourceScope,
    savedDraft: persistableDraft,
    lastSavedAt: draft?.savedAt ?? null,
    savedSignature: createDraftSignature(persistableDraft),
    savedWorkspace: persistableDraft.workspace,
    scale: persistableDraft.scale,
    taskHistories,
    timeUnit: persistableDraft.timeUnit,
    workspace,
  };
}

/** 変更内容に応じて、問題を開いたときの詳細セクションを決定します。 */
export function getHealthIssueFocusTarget(
  issue: ScheduleHealthIssue,
): TaskInspectorFocusTarget | undefined {
  if (issue.category === "assign") {
    return "assignees";
  }
  if (issue.category === "calendar") {
    return issue.id.includes("-end-non-working") ? "end" : "start";
  }
  if (issue.category === "dependency") {
    return "dependencies";
  }
  if (issue.category === "load") {
    return "allocations";
  }
  if (issue.category === "schedule") {
    return "start";
  }
  return undefined;
}

/** 現在のプロジェクトだけを保存済みドラフトへ反映します。 */
export function mergeProjectScopedSavedDraft(
  savedDraft: PersistableDraft,
  currentDraft: PersistableDraft,
  projectId: string,
): PersistableDraft {
  const currentSchedule = currentDraft.workspace.schedules.find(
    (snapshot) => snapshot.project.id === projectId,
  );
  if (!currentSchedule) {
    return savedDraft;
  }
  const savedSchedule = savedDraft.workspace.schedules.find(
    (snapshot) => snapshot.project.id === projectId,
  );
  const nextSchedule = savedSchedule
    ? {
        ...savedSchedule,
        calendar: currentSchedule.calendar,
        issues: currentSchedule.issues ?? [],
        project: currentSchedule.project,
        tasks: currentSchedule.tasks,
        workLogs: currentSchedule.workLogs ?? [],
      }
    : currentSchedule;
  const hasSavedSchedule = savedDraft.workspace.schedules.some(
    (snapshot) => snapshot.project.id === projectId,
  );

  return {
    ...savedDraft,
    activeProjectId: currentDraft.activeProjectId,
    activeTab: currentDraft.activeTab,
    activeTeamId: currentDraft.activeTeamId,
    activityLogs: {
      ...savedDraft.activityLogs,
      [projectId]: currentDraft.activityLogs[projectId] ?? [],
    },
    calendarAware: currentDraft.calendarAware,
    collapsedIdsByProject: {
      ...savedDraft.collapsedIdsByProject,
      [projectId]: currentDraft.collapsedIdsByProject[projectId] ?? [],
    },
    columnVisibility: currentDraft.columnVisibility,
    favoriteProjectIds: currentDraft.favoriteProjectIds,
    filterOpen: currentDraft.filterOpen,
    filters: currentDraft.filters,
    resourceDisplaySettings: currentDraft.resourceDisplaySettings,
    resourceScope: currentDraft.resourceScope,
    scale: currentDraft.scale,
    timeUnit: currentDraft.timeUnit,
    workspace: {
      ...savedDraft.workspace,
      schedules: hasSavedSchedule
        ? savedDraft.workspace.schedules.map((snapshot) =>
            snapshot.project.id === projectId ? nextSchedule : snapshot,
          )
        : [...savedDraft.workspace.schedules, nextSchedule],
    },
  };
}
