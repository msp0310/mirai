import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { GanttWorkbench } from "../features/gantt/components/GanttWorkbench";
import { Sidebar } from "../components/layout/Sidebar";
import {
  Topbar,
  type ApiConnectionMode,
  type ExportFormat,
  type TopbarNotification,
} from "../components/layout/Topbar";
import { type ViewTab } from "../components/layout/ViewTabs";
import type { ProjectImportMode } from "../features/projects/components/ProjectImportSheet";
import type { CreateProjectTemplateInput } from "../features/projects/components/ProjectCreateSheet";
import type { TaskCsvImportOptions } from "../features/gantt/components/TaskCsvImportSheet";
import { ToastViewport } from "../components/ui/ToastViewport";
import {
  buildTaskChangeReview,
  buildWorkspaceTaskChangeReview,
  buildWorkspaceConfigChangeReview,
} from "../lib/changeReview";
import { type AuthUser } from "../data/authRepository";
import { type ProjectSummary, type ScheduleSnapshot } from "../data/scheduleRepository";
import { apiScheduleRepository } from "../data/apiScheduleRepository";
import { createProjectFromTemplate } from "../data/projectTemplates";
import {
  createBrabioXlsxImportDraft,
  createTaskCsvImportDraft,
  parseTaskCsvImportFromDraft,
  parseProjectImportJson,
  ProjectImportError,
  type TaskCsvImportDraft,
  type TaskCsvImportMapping,
  validateTaskCsvImportData,
  validateProjectImportData,
} from "../data/scheduleImportExport";
import { clearLocalScheduleDraft, saveLocalScheduleDraft } from "../data/localScheduleStorage";
import { normalizeSummaryTasks, type TaskPasteMode } from "../lib/taskOperations";
import {
  buildGanttHeaderColumns,
  buildResourceMatrix,
  buildTimeline,
  buildWeekColumns,
  filterTaskRows,
  flattenTasks,
  formatShortDate,
  getProgressStats,
} from "../lib/schedule";
import { buildScheduleHealthReport, type ScheduleHealthIssue } from "../lib/scheduleHealth";
import { buildCrossProjectResourceRows } from "../lib/resourceCalculations";
import { getActiveMembers, isMemberActive } from "../lib/members";
import { getProjectAssignedMembers, projectLifecycleLabels } from "../lib/projects";
import type { ScheduleFilters, TaskStatus } from "../types/schedule";
import type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityTone,
  CalendarDefinition,
  GanttScale,
  GanttTimeUnit,
  Member,
  Project,
  ProjectLifecycleStatus,
  ResourceDisplaySettings,
  ResourceScope,
  TaskInspectorFocusTarget,
  Team,
} from "../types/schedule";
import {
  createConfigChangeReviewFromRows,
  createDraftSignature,
  createLocalDraftChangeSummary,
  createPersistableDraft,
  getOperationalProjectStatus,
  getProjectIdFromHash,
  getHealthIssueFocusTarget,
  getTaskRange,
  initialFilters,
  isProjectArchived,
  mergeProjectScopedSavedDraft,
  writeProjectHash,
} from "./appState";
import type { ApiSyncState, AppInitialState, TaskClipboard } from "./appTypes";
import { buildTopbarSyncQueueItems, createTopbarSyncStatus } from "./syncPresentation";
import { useToastQueue } from "../hooks/useToastQueue";
import { useGanttKeyboardShortcuts } from "../features/gantt/hooks/useGanttKeyboardShortcuts";
import { findMissingProjectIds, mergeScheduleIntoWorkspace } from "./projectLoading";
import { useTaskHistory } from "../features/gantt/hooks/useTaskHistory";
import { useProjectActivityActions } from "../features/projects/hooks/useProjectActivityActions";
import { useTaskActions } from "../features/gantt/hooks/useTaskActions";
import { useScheduleSync } from "./useScheduleSync";
import { useTaskSelection } from "../features/gantt/hooks/useTaskSelection";
import { useWorkbenchOverlays, type PendingTaskCsvImport } from "./useWorkbenchOverlays";

type AppWorkbenchProps = {
  currentUser: AuthUser;
  initialAppState: AppInitialState;
  onLogout: () => Promise<void>;
  onReloadWorkspace: () => void;
};

type CollapsedIdUpdate = Set<string> | ((current: Set<string>) => Set<string>);

const ActivityPanel = lazy(() =>
  import("../features/activity/components/ActivityPanel").then((module) => ({
    default: module.ActivityPanel,
  })),
);

const CalendarPanel = lazy(() =>
  import("../features/calendar/components/CalendarPanel").then((module) => ({
    default: module.CalendarPanel,
  })),
);

const HelpPage = lazy(() =>
  import("../features/help/components/HelpPage").then((module) => ({
    default: module.HelpPage,
  })),
);

const ProjectIssuePanel = lazy(() =>
  import("../features/issues/components/ProjectIssuePanel").then((module) => ({
    default: module.ProjectIssuePanel,
  })),
);

const WorkLogPanel = lazy(() =>
  import("../features/worklogs/components/WorkLogPanel").then((module) => ({
    default: module.WorkLogPanel,
  })),
);

const CreateTaskSheet = lazy(() =>
  import("../features/gantt/components/CreateTaskSheet").then((module) => ({
    default: module.CreateTaskSheet,
  })),
);

const MilestonePanel = lazy(() =>
  import("../features/milestones/components/MilestonePanel").then((module) => ({
    default: module.MilestonePanel,
  })),
);

const MasterSettingsPage = lazy(() =>
  import("../features/settings/components/MasterSettingsSheet").then((module) => ({
    default: module.MasterSettingsPage,
  })),
);

const ProjectCreateSheet = lazy(() =>
  import("../features/projects/components/ProjectCreateSheet").then((module) => ({
    default: module.ProjectCreateSheet,
  })),
);

const ProjectImportSheet = lazy(() =>
  import("../features/projects/components/ProjectImportSheet").then((module) => ({
    default: module.ProjectImportSheet,
  })),
);

const ProjectPortfolioPanel = lazy(() =>
  import("../features/projects/components/ProjectPortfolioPanel").then((module) => ({
    default: module.ProjectPortfolioPanel,
  })),
);

const ProjectSettingsPage = lazy(() =>
  import("../features/projects/components/ProjectSettingsSheet").then((module) => ({
    default: module.ProjectSettingsPage,
  })),
);

const ResetDraftDialog = lazy(() =>
  import("../features/gantt/components/ResetDraftDialog").then((module) => ({
    default: module.ResetDraftDialog,
  })),
);

const ResourcePanel = lazy(() =>
  import("../features/resource/components/ResourcePanel").then((module) => ({
    default: module.ResourcePanel,
  })),
);

const SaveReviewDialog = lazy(() =>
  import("../features/gantt/components/SaveReviewDialog").then((module) => ({
    default: module.SaveReviewDialog,
  })),
);

const ShortcutHelpSheet = lazy(() =>
  import("../features/gantt/components/ShortcutHelpSheet").then((module) => ({
    default: module.ShortcutHelpSheet,
  })),
);

const SummaryStrip = lazy(() =>
  import("../features/status/components/SummaryStrip").then((module) => ({
    default: module.SummaryStrip,
  })),
);

const BrabioTaskImportSheet = lazy(() =>
  import("../features/gantt/components/BrabioTaskImportSheet").then((module) => ({
    default: module.BrabioTaskImportSheet,
  })),
);

const TaskCsvImportSheet = lazy(() =>
  import("../features/gantt/components/TaskCsvImportSheet").then((module) => ({
    default: module.TaskCsvImportSheet,
  })),
);

const TaskInspector = lazy(() =>
  import("../features/gantt/components/TaskInspector").then((module) => ({
    default: module.TaskInspector,
  })),
);

type ActivityInput = {
  category: ActivityCategory;
  detail: string;
  projectId?: string;
  taskId?: string;
  title: string;
  tone?: ActivityTone;
};

/** 表示履歴に記録する操作ユーザー名です。認証ユーザー表示への切替点を固定します。 */
const activityActor = "操作ユーザー";

/** 指定したタスクのタイトル編集欄へフォーカスを移します。 */
function focusTaskTitleEditor(taskId: string) {
  const rowSelector = `.task-table-row[data-task-id="${taskId}"]`;
  const inputSelector = `${rowSelector} input[data-inline-field="title"]`;

  /** focusInputを実行し、関連する処理をまとめます。 */
  function focusInput() {
    const input = document.querySelector<HTMLInputElement>(inputSelector);
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  if (focusInput()) return;
  document.querySelector<HTMLElement>(`${rowSelector} [data-title-edit-trigger="true"]`)?.click();
  window.requestAnimationFrame(focusInput);
}

/** CSV出力用に値をエスケープします。 */
function escapeCsv(value: string) {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/** テキストファイルをブラウザからダウンロードします。 */
function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 取込データ用の重複しないIDを生成します。 */
function createUniqueImportedId(baseId: string, existingIds: Set<string>) {
  const base = baseId.trim() || "imported-project";
  if (!existingIds.has(base)) return base;

  let suffix = 2;
  let candidate = `${base}-import`;
  while (existingIds.has(candidate)) {
    candidate = `${base}-import-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** 遅延ロード中のプロジェクトビューに表示する共通プレースホルダーです。 */
function ViewLoading({ label }: { label: string }) {
  return <div className="view-loading">{label}</div>;
}

/** 詳細スナップショットから案件一覧用の軽量集計を一度だけ作成します。 */
function createProjectSummaryFromSnapshot(snapshot: ScheduleSnapshot): ProjectSummary {
  const stats = getProgressStats(snapshot.tasks);
  return {
    completedTaskCount: stats.completed,
    delayedTaskCount: snapshot.tasks.filter(
      (task) => task.type === "task" && task.status === "delayed",
    ).length,
    memberCount: snapshot.project.memberIds?.length ?? snapshot.members.length,
    progress: stats.progress,
    project: snapshot.project,
    taskCount: stats.total,
  };
}

/** プロジェクト状態・タスク操作・各ビューを束ねる認証後のアプリケーションシェルです。 */
export function AppWorkbench({
  currentUser,
  initialAppState,
  onLogout,
  onReloadWorkspace,
}: AppWorkbenchProps) {
  const [workspace, setWorkspace] = useState(initialAppState.workspace);
  const [activeTeamId, setActiveTeamId] = useState(initialAppState.activeTeamId);
  const [activeProjectId, setActiveProjectId] = useState(initialAppState.activeProjectId);
  const [activeTab, setActiveTab] = useState<ViewTab>(initialAppState.activeTab);
  const [filters, setFilters] = useState<ScheduleFilters>(initialAppState.filters);
  const [collapsedIdsByProject, setCollapsedIdsByProject] = useState<Record<string, string[]>>(
    initialAppState.collapsedIdsByProject,
  );
  const [filterOpen, setFilterOpen] = useState(initialAppState.filterOpen);
  const [calendarAware, setCalendarAware] = useState(initialAppState.calendarAware);
  const [columnVisibility, setColumnVisibility] = useState(initialAppState.columnVisibility);
  const {
    pendingProjectImport,
    pendingTaskCsvImport,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowHelpPage,
    setShowMasterSettings,
    setShowProjectCreateSheet,
    setShowProjectSettings,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    showCreateSheet,
    showHelpPage,
    showMasterSettings,
    showProjectCreateSheet,
    showProjectSettings,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
  } = useWorkbenchOverlays();
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [teamResourcesLoading, setTeamResourcesLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState(initialAppState.activityLogs);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<Set<string>>(
    () => new Set(initialAppState.favoriteProjectIds),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialAppState.lastSavedAt);
  const [savedSignature, setSavedSignature] = useState(initialAppState.savedSignature);
  const [savedWorkspace, setSavedWorkspace] = useState(initialAppState.savedWorkspace);
  const [apiConnectionMode, setApiConnectionMode] = useState<ApiConnectionMode>("online");
  const [apiSyncState, setApiSyncState] = useState<ApiSyncState>({
    error: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    queuedChangeCount: 0,
    status: "idle",
  });
  const [saveRequestId, setSaveRequestId] = useState(0);
  const [scale, setScale] = useState<GanttScale>(initialAppState.scale);
  const [resourceDisplaySettings, setResourceDisplaySettings] = useState<ResourceDisplaySettings>(
    initialAppState.resourceDisplaySettings,
  );
  const [resourceScope, setResourceScope] = useState<ResourceScope>(initialAppState.resourceScope);
  const [timeUnit, setTimeUnit] = useState<GanttTimeUnit>(initialAppState.timeUnit);
  const [ganttDisplayMode, setGanttDisplayMode] = useState<"gantt" | "table">("gantt");
  const [todaySignal, setTodaySignal] = useState(0);
  const [taskStartFocusSignal, setTaskStartFocusSignal] = useState(0);
  const [taskClipboard, setTaskClipboard] = useState<TaskClipboard | null>(null);
  const [taskPasteMode] = useState<TaskPasteMode>("sibling");
  const taskClipboardRef = useRef<TaskClipboard | null>(null);
  const activityIdRef = useRef(0);
  const apiConnectionModeRef = useRef<ApiConnectionMode>(apiConnectionMode);
  const initialRouteNoticeShownRef = useRef(false);
  const projectLoadRequestIdRef = useRef(0);
  const saveOperationIdRef = useRef(0);
  const { addToast, dismissToast, toasts } = useToastQueue();
  const projectSummaries = useMemo(
    () => workspace.projectSummaries ?? workspace.schedules.map(createProjectSummaryFromSnapshot),
    [workspace.projectSummaries, workspace.schedules],
  );

  const activeTeamProjects = useMemo(
    () =>
      projectSummaries
        .map((summary) => summary.project)
        .filter((project) => project.teamId === activeTeamId && !isProjectArchived(project)),
    [activeTeamId, projectSummaries],
  );
  const workspaceProjects = useMemo(
    () => projectSummaries.map((summary) => summary.project),
    [projectSummaries],
  );
  const activeProjectCount = useMemo(
    () => projectSummaries.filter((summary) => !isProjectArchived(summary.project)).length,
    [projectSummaries],
  );
  const schedule =
    workspace.schedules.find((snapshot) => snapshot.project.id === activeProjectId) ??
    workspace.schedules[0];
  const { commitTasks, initializeProject, replaceProject, redo, taskHistories, tasks, undo } =
    useTaskHistory({
      initialHistories: initialAppState.taskHistories,
      onActivity: recordActivity,
      onToast: addToast,
      projectId: schedule.project.id,
      sourceTasks: schedule.tasks,
    });
  const currentReviewSchedules = useMemo(
    () =>
      workspace.schedules.map((snapshot) => ({
        ...snapshot,
        tasks: taskHistories[snapshot.project.id]?.present ?? normalizeSummaryTasks(snapshot.tasks),
      })),
    [taskHistories, workspace.schedules],
  );

  const timeline = useMemo(
    () =>
      buildTimeline(
        schedule.project.rangeStart,
        schedule.project.rangeEnd,
        schedule.calendar,
        calendarAware,
        timeUnit,
      ),
    [calendarAware, schedule, timeUnit],
  );
  const dayTimeline = useMemo(
    () =>
      buildTimeline(
        schedule.project.rangeStart,
        schedule.project.rangeEnd,
        schedule.calendar,
        calendarAware,
        "day",
      ),
    [calendarAware, schedule],
  );
  const ganttColumns = useMemo(
    () => buildGanttHeaderColumns(timeline, timeUnit),
    [timeline, timeUnit],
  );
  const resourceWeeks = useMemo(() => buildWeekColumns(dayTimeline), [dayTimeline]);
  const collapsedIds = useMemo(
    () => new Set(collapsedIdsByProject[activeProjectId] ?? []),
    [activeProjectId, collapsedIdsByProject],
  );
  const flattenedRows = useMemo(() => flattenTasks(tasks, collapsedIds), [collapsedIds, tasks]);
  const visibleRows = useMemo(
    () => filterTaskRows(flattenedRows, filters),
    [flattenedRows, filters],
  );
  const {
    clearTaskSelection,
    closeTaskInspector,
    openTaskInspector,
    selectOnlyTask,
    selectTask,
    selectTaskIds,
    selectTaskRange,
    selectedTaskId,
    selectedTaskIds,
    selectionAnchorTaskId,
    taskFocusRequest,
    taskInspectorTaskId,
  } = useTaskSelection({ visibleRows });
  const activeTeam =
    workspace.teams.find((team) => team.id === schedule.project.teamId) ?? workspace.teams[0];
  const projectMembers = useMemo(() => {
    const projectMemberIds = new Set(
      getProjectAssignedMembers({
        members: schedule.members,
        project: schedule.project,
        team: activeTeam,
      }).map((member) => member.id),
    );
    const assignedMemberIds = new Set(tasks.flatMap((task) => task.assigneeIds));
    const scopedMembers = schedule.members.filter(
      (member) =>
        (projectMemberIds.has(member.id) && isMemberActive(member)) ||
        assignedMemberIds.has(member.id),
    );
    return scopedMembers.length > 0 ? scopedMembers : getActiveMembers(schedule.members);
  }, [activeTeam, schedule.members, schedule.project, tasks]);
  const taskActions = useTaskActions({
    calendar: schedule.calendar,
    calendarAware,
    clearTaskSelection,
    commitTasks,
    onActivity: recordActivity,
    onToast: addToast,
    projectMembers,
    projectRangeStart: schedule.project.rangeStart,
    scheduleMembers: schedule.members,
    selectedTaskId,
    selectedTaskIds,
    selectAndFocusTaskTitle,
    selectOnlyTask,
    setCollapsedIds,
    setShowCreateSheet,
    setTaskClipboard,
    taskClipboard,
    taskClipboardRef,
    taskPasteMode,
    tasks,
    visibleRows,
  });
  const {
    createProjectIssue,
    createProjectWorkLog,
    deleteProjectWorkLog,
    updateProjectIssue,
    updateProjectWorkLog,
  } = useProjectActivityActions({
    currentUserName: currentUser.name,
    defaultMemberId: projectMembers[0]?.id,
    onActivity: recordActivity,
    onToast: addToast,
    projectId: schedule.project.id,
    projectName: schedule.project.workspace,
    selectedTaskId,
    setWorkspace,
  });
  const activeTeamReviewSchedules = useMemo(
    () =>
      currentReviewSchedules.filter(
        (snapshot) =>
          snapshot.project.teamId === activeTeamId && !isProjectArchived(snapshot.project),
      ),
    [activeTeamId, currentReviewSchedules],
  );

  useEffect(() => {
    if (resourceScope !== "team") return;
    const missingProjectIds = findMissingProjectIds(
      projectSummaries,
      workspace.schedules,
      activeTeamId,
    );
    if (missingProjectIds.length === 0) return;

    let cancelled = false;
    setTeamResourcesLoading(true);
    Promise.all(
      missingProjectIds.map((projectId) => apiScheduleRepository.getProjectSchedule(projectId)),
    )
      .then((schedules) => {
        if (cancelled) return;
        setWorkspace((current) => schedules.reduce(mergeScheduleIntoWorkspace, current));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        addToast({
          detail: error instanceof Error ? error.message : "チーム案件を取得できませんでした。",
          title: "Resourceを読み込めませんでした",
          tone: "warning",
        });
      })
      .finally(() => {
        if (!cancelled) setTeamResourcesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTeamId, projectSummaries, resourceScope, workspace.schedules]);
  const teamResourceTasks = useMemo(
    () =>
      activeTeamReviewSchedules.flatMap((snapshot) =>
        snapshot.tasks.map((task) => ({
          ...task,
          sourceProjectId: snapshot.project.id,
          sourceProjectName: snapshot.project.workspace,
        })),
      ),
    [activeTeamReviewSchedules],
  );
  const teamResourceMembers = useMemo(() => {
    const teamMemberIds = new Set(activeTeam?.memberIds ?? []);
    const assignedMemberIds = new Set(teamResourceTasks.flatMap((task) => task.assigneeIds));
    const memberById = new Map<string, Member>();
    activeTeamReviewSchedules.forEach((snapshot) => {
      snapshot.members.forEach((member) => memberById.set(member.id, member));
    });
    const scopedMembers = [...memberById.values()].filter(
      (member) =>
        (teamMemberIds.has(member.id) && isMemberActive(member)) ||
        assignedMemberIds.has(member.id),
    );
    return scopedMembers.length > 0 ? scopedMembers : projectMembers;
  }, [activeTeam, activeTeamReviewSchedules, projectMembers, teamResourceTasks]);
  const teamResourceRange = useMemo(() => {
    if (activeTeamReviewSchedules.length === 0) {
      return {
        end: schedule.project.rangeEnd,
        start: schedule.project.rangeStart,
      };
    }
    const starts = activeTeamReviewSchedules.map((snapshot) => snapshot.project.rangeStart);
    const ends = activeTeamReviewSchedules.map((snapshot) => snapshot.project.rangeEnd);
    return {
      end: [...ends].sort().at(-1) ?? schedule.project.rangeEnd,
      start: [...starts].sort()[0] ?? schedule.project.rangeStart,
    };
  }, [activeTeamReviewSchedules, schedule.project.rangeEnd, schedule.project.rangeStart]);
  const teamResourceWeeks = useMemo(
    () =>
      buildWeekColumns(
        buildTimeline(
          teamResourceRange.start,
          teamResourceRange.end,
          schedule.calendar,
          calendarAware,
          "day",
        ),
      ),
    [calendarAware, schedule.calendar, teamResourceRange],
  );
  const teamResourceRows = useMemo(
    () =>
      buildCrossProjectResourceRows({
        baseCalendar: schedule.calendar,
        calendarAware,
        members: teamResourceMembers,
        schedules: activeTeamReviewSchedules,
        weeks: teamResourceWeeks,
      }),
    [
      activeTeamReviewSchedules,
      calendarAware,
      schedule.calendar,
      teamResourceMembers,
      teamResourceWeeks,
    ],
  );
  const resourceRows = useMemo(
    () =>
      buildResourceMatrix(tasks, projectMembers, resourceWeeks, schedule.calendar, calendarAware),
    [calendarAware, projectMembers, schedule, tasks, resourceWeeks],
  );
  const displayedResourceRows = resourceScope === "team" ? teamResourceRows : resourceRows;
  const displayedResourceWeeks = resourceScope === "team" ? teamResourceWeeks : resourceWeeks;
  const stats = useMemo(() => getProgressStats(tasks), [tasks]);
  const healthReport = useMemo(
    () =>
      buildScheduleHealthReport({
        calendar: schedule.calendar,
        calendarAware,
        members: projectMembers,
        project: schedule.project,
        resourceRows,
        tasks,
      }),
    [calendarAware, projectMembers, resourceRows, schedule.calendar, schedule.project, tasks],
  );
  const taskInspectorTask = tasks.find((task) => task.id === taskInspectorTaskId) ?? null;
  const activeIssues = schedule.issues ?? [];
  const activeWorkLogs = schedule.workLogs ?? [];
  const activeActivityEntries = activityLogs[schedule.project.id] ?? [];
  const workspaceTaskChangeReview = useMemo(
    () =>
      buildWorkspaceTaskChangeReview({
        currentSchedules: currentReviewSchedules,
        savedSchedules: savedWorkspace.schedules,
      }),
    [currentReviewSchedules, savedWorkspace.schedules],
  );
  const savedActiveSchedule = useMemo(
    () => savedWorkspace.schedules.find((snapshot) => snapshot.project.id === schedule.project.id),
    [savedWorkspace.schedules, schedule.project.id],
  );
  const activeProjectTaskChangeReview = useMemo(
    () =>
      buildTaskChangeReview({
        currentTasks: tasks,
        members: schedule.members,
        projectId: schedule.project.id,
        projectLabel: schedule.project.workspace,
        savedTasks: savedActiveSchedule?.tasks ?? [],
      }),
    [
      savedActiveSchedule?.tasks,
      schedule.members,
      schedule.project.id,
      schedule.project.workspace,
      tasks,
    ],
  );
  const memberAssignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentReviewSchedules.forEach((snapshot) => {
      snapshot.tasks.forEach((task) => {
        task.assigneeIds.forEach((memberId) => {
          counts[memberId] = (counts[memberId] ?? 0) + 1;
        });
      });
    });
    return counts;
  }, [currentReviewSchedules]);
  const topbarNotifications = useMemo<TopbarNotification[]>(() => {
    const delayedTasks = tasks.filter((task) => task.type === "task" && task.status === "delayed");
    const nextMilestone = tasks
      .filter((task) => task.type === "milestone" && task.status !== "done")
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    const overloadedRows = resourceRows.filter((row) => row.utilization >= 90);
    return [
      delayedTasks.length > 0
        ? {
            detail: `${delayedTasks[0].title}${
              delayedTasks.length > 1 ? ` ほか${delayedTasks.length - 1}件` : ""
            }`,
            id: "delayed-tasks",
            title: `遅延タスクが${delayedTasks.length}件あります`,
            tone: "danger" as const,
          }
        : null,
      nextMilestone
        ? {
            detail: `${formatShortDate(nextMilestone.start)} ${nextMilestone.title}`,
            id: "next-milestone",
            title: "次のマイルストーン",
            tone: "info" as const,
          }
        : null,
      overloadedRows.length > 0
        ? {
            detail: `${overloadedRows[0].member.name} ${overloadedRows[0].utilization}%`,
            id: "resource-overload",
            title: "高負荷メンバーを確認してください",
            tone: "warning" as const,
          }
        : null,
      healthReport.dangerCount > 0
        ? {
            detail: healthReport.issues[0]?.title ?? "データ整合性を確認してください",
            id: "schedule-health",
            title: `健全性エラーが${healthReport.dangerCount}件あります`,
            tone: "danger" as const,
          }
        : healthReport.warningCount > 0
          ? {
              detail: healthReport.issues[0]?.title ?? "データ整合性を確認してください",
              id: "schedule-health",
              title: `健全性の確認事項が${healthReport.warningCount}件あります`,
              tone: "warning" as const,
            }
          : null,
    ].filter((notification): notification is TopbarNotification => Boolean(notification));
  }, [healthReport, resourceRows, tasks]);
  const currentDraft = useMemo(
    () =>
      createPersistableDraft({
        activeProjectId,
        activeTab,
        activeTeamId,
        activityLogs,
        calendarAware,
        columnVisibility,
        collapsedIdsByProject,
        favoriteProjectIds,
        filterOpen,
        filters,
        resourceDisplaySettings,
        resourceScope,
        scale,
        taskHistories,
        timeUnit,
        workspace,
      }),
    [
      activeProjectId,
      activeTab,
      activeTeamId,
      activityLogs,
      calendarAware,
      columnVisibility,
      collapsedIdsByProject,
      favoriteProjectIds,
      filterOpen,
      filters,
      resourceDisplaySettings,
      resourceScope,
      scale,
      taskHistories,
      timeUnit,
      workspace,
    ],
  );
  const workspaceConfigChangeReview = useMemo(
    () =>
      buildWorkspaceConfigChangeReview({
        currentWorkspace: currentDraft.workspace,
        savedWorkspace,
      }),
    [currentDraft.workspace, savedWorkspace],
  );
  const activeProjectConfigChangeReview = useMemo(
    () =>
      createConfigChangeReviewFromRows(
        workspaceConfigChangeReview.rows.filter(
          (row) =>
            row.projectId === schedule.project.id &&
            (row.category === "project" || row.category === "calendar"),
        ),
      ),
    [schedule.project.id, workspaceConfigChangeReview.rows],
  );
  const isProjectSaveScope = !showMasterSettings && activeTab !== "Projects";
  const projectSaveScopeLabel =
    activeTab === "Issues" || activeTab === "WorkLogs" ? "この案件" : "このガント";
  const saveScopeLabel = isProjectSaveScope
    ? projectSaveScopeLabel
    : showMasterSettings
      ? "管理設定"
      : "プロジェクト一覧";
  const taskChangeReview = isProjectSaveScope
    ? activeProjectTaskChangeReview
    : workspaceTaskChangeReview;
  const configChangeReview = isProjectSaveScope
    ? activeProjectConfigChangeReview
    : workspaceConfigChangeReview;
  const currentSignature = useMemo(() => createDraftSignature(currentDraft), [currentDraft]);
  const hasUnsavedChanges = currentSignature !== savedSignature;
  const savedDraftRef = useRef(initialAppState.savedDraft);
  const localDraftChangeSummary = useMemo(
    () => createLocalDraftChangeSummary(currentDraft, savedDraftRef.current),
    [currentDraft, savedSignature],
  );
  const syncStatus = useMemo(
    () =>
      createTopbarSyncStatus({
        apiConnectionMode,
        apiSyncState,
        hasUnsavedChanges,
        lastSavedAt,
        pendingConfigChangeCount: configChangeReview.totalCount,
        pendingLocalDraftChangeCount: localDraftChangeSummary.count,
        pendingLocalDraftChangeDetail: localDraftChangeSummary.detail,
        pendingTaskChangeCount: taskChangeReview.totalCount,
        scopeLabel: saveScopeLabel,
      }),
    [
      apiConnectionMode,
      apiSyncState,
      configChangeReview.totalCount,
      hasUnsavedChanges,
      lastSavedAt,
      localDraftChangeSummary.count,
      localDraftChangeSummary.detail,
      saveScopeLabel,
      taskChangeReview.totalCount,
    ],
  );
  const syncQueueItems = useMemo(
    () =>
      buildTopbarSyncQueueItems({
        apiSyncState,
        configChangeReview,
        hasUnsavedChanges,
        localDraftChangeSummary,
        taskChangeReview,
      }),
    [
      apiSyncState,
      configChangeReview,
      hasUnsavedChanges,
      localDraftChangeSummary,
      taskChangeReview,
    ],
  );
  const currentDraftRef = useRef(currentDraft);
  const activityLogsRef = useRef(activityLogs);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const taskChangeReviewRef = useRef(taskChangeReview);
  const configChangeReviewRef = useRef(configChangeReview);
  const { changeApiConnectionMode, retryApiSync, scheduleApiSync } = useScheduleSync({
    addToast,
    apiConnectionModeRef,
    apiSyncState,
    hasUnsavedChangesRef,
    requestSaveDraft,
    saveOperationIdRef,
    savedDraftRef,
    setApiConnectionMode,
    setApiSyncState,
    setLastSavedAt,
    setSavedSignature,
    setSavedWorkspace,
    setWorkspace,
  });

  useEffect(() => {
    currentDraftRef.current = currentDraft;
  }, [currentDraft]);

  useEffect(() => {
    activityLogsRef.current = activityLogs;
  }, [activityLogs]);

  useEffect(() => {
    apiConnectionModeRef.current = apiConnectionMode;
  }, [apiConnectionMode]);

  useEffect(() => {
    if (initialRouteNoticeShownRef.current) return;
    initialRouteNoticeShownRef.current = true;
    if (!initialAppState.routeProjectId) return;

    if (initialAppState.routeProjectMatched) {
      addToast({
        detail: schedule.project.workspace,
        title: "共有リンクから開きました",
        tone: "info",
      });
      return;
    }

    addToast({
      detail: initialAppState.routeProjectId,
      title: "共有リンクのプロジェクトが見つかりません",
      tone: "warning",
    });
  }, []);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    taskChangeReviewRef.current = taskChangeReview;
    configChangeReviewRef.current = configChangeReview;
  }, [configChangeReview, hasUnsavedChanges, taskChangeReview]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const currentWithSavedNavigation = {
      ...currentDraft,
      activeProjectId: savedDraftRef.current.activeProjectId,
      activeTeamId: savedDraftRef.current.activeTeamId,
    };
    if (
      createDraftSignature(currentWithSavedNavigation) ===
      createDraftSignature(savedDraftRef.current)
    ) {
      persistNavigationState(activeProjectId, activeTeamId);
    }
  }, [activeProjectId, activeTeamId, currentDraft, hasUnsavedChanges]);

  useEffect(() => {
    if (showMasterSettings || (activeTab === "Projects" && !showProjectSettings)) return;
    writeProjectHash(activeProjectId, "replace");
  }, [activeProjectId, activeTab, showMasterSettings, showProjectSettings]);

  useEffect(() => {
    function handleProjectRouteChange() {
      const projectId = getProjectIdFromHash();
      if (!projectId || projectId === activeProjectId) return;
      const nextProject =
        workspace.schedules.find((snapshot) => snapshot.project.id === projectId)?.project ??
        projectSummaries.find((summary) => summary.project.id === projectId)?.project;
      if (!nextProject) {
        addToast({
          detail: projectId,
          title: "共有リンクのプロジェクトが見つかりません",
          tone: "warning",
        });
        writeProjectHash(activeProjectId, "replace");
        return;
      }
      if (isProjectArchived(nextProject)) {
        addToast({
          detail: nextProject.workspace,
          title: "アーカイブ済みプロジェクトです",
          tone: "warning",
        });
        writeProjectHash(activeProjectId, "replace");
        return;
      }
      activateProject(nextProject.id, { updateHash: false });
    }

    window.addEventListener("hashchange", handleProjectRouteChange);
    window.addEventListener("popstate", handleProjectRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleProjectRouteChange);
      window.removeEventListener("popstate", handleProjectRouteChange);
    };
  }, [activeProjectId, projectSummaries, workspace.schedules]);

  /** 案件単位の操作履歴を記録します。 */
  function recordActivity({
    category,
    detail,
    projectId = schedule.project.id,
    taskId,
    title,
    tone = "info",
  }: ActivityInput) {
    const entry = createActivityEntry({
      category,
      detail,
      projectId,
      taskId,
      title,
      tone,
    });
    setActivityLogSnapshot(appendActivityLogEntry(activityLogsRef.current, entry));
  }

  /** 操作履歴の現在値を更新します。 */
  function setActivityLogSnapshot(logs: Record<string, ActivityLogEntry[]>) {
    activityLogsRef.current = logs;
    setActivityLogs(logs);
  }

  /** 現在の案件・チーム選択をローカル保存します。 */
  function persistNavigationState(projectId: string, teamId: string) {
    const nextSavedDraft = {
      ...savedDraftRef.current,
      activeProjectId: projectId,
      activeTeamId: teamId,
    };
    const saved = saveLocalScheduleDraft(nextSavedDraft);
    savedDraftRef.current = nextSavedDraft;
    setLastSavedAt(saved.savedAt);
    setSavedSignature(createDraftSignature(nextSavedDraft));
    setSavedWorkspace(nextSavedDraft.workspace);
  }

  /** 操作履歴のエントリを生成します。 */
  function createActivityEntry({
    category,
    detail,
    projectId = schedule.project.id,
    taskId,
    title,
    tone = "info",
  }: ActivityInput): ActivityLogEntry {
    const nextIndex = activityIdRef.current + 1;
    activityIdRef.current = nextIndex;
    const happenedAt = new Date().toISOString();
    return {
      actor: activityActor,
      category,
      detail,
      happenedAt,
      id: `${projectId}-${happenedAt}-${nextIndex}`,
      projectId,
      taskId,
      title,
      tone,
    };
  }

  /** 操作履歴を上限付きで先頭へ追加します。 */
  function appendActivityLogEntry(
    logs: Record<string, ActivityLogEntry[]>,
    entry: ActivityLogEntry,
  ) {
    return {
      ...logs,
      [entry.projectId]: [entry, ...(logs[entry.projectId] ?? [])].slice(0, 160),
    };
  }

  /** タスクを選択し、タイトル編集へフォーカスします。 */
  function selectAndFocusTaskTitle(taskId: string) {
    selectOnlyTask(taskId);
    setActiveTab("Gantt");
    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-task-id="${taskId}"]`);
      row?.scrollIntoView({ block: "nearest", inline: "nearest" });
      focusTaskTitleEditor(taskId);
    });
  }

  /** 現在案件の折りたたみ状態を更新します。 */
  function setCollapsedIds(update: CollapsedIdUpdate) {
    setCollapsedIdsForProject(activeProjectId, update);
  }

  /** 指定案件の折りたたみ状態を更新します。 */
  function setCollapsedIdsForProject(projectId: string, update: CollapsedIdUpdate) {
    setCollapsedIdsByProject((current) => {
      const currentSet = new Set(current[projectId] ?? []);
      const nextSet = typeof update === "function" ? update(currentSet) : new Set(update);
      const nextIds = [...nextSet].sort();
      const { [projectId]: previousProjectIds, ...rest } = current;
      if (nextIds.length === 0) {
        return previousProjectIds === undefined ? current : rest;
      }
      const previousIds = previousProjectIds ?? [];
      if (
        previousIds.length === nextIds.length &&
        previousIds.every((id, index) => id === nextIds[index])
      ) {
        return current;
      }
      return {
        ...current,
        [projectId]: nextIds,
      };
    });
  }

  /** 指定タスクの折りたたみ状態を切り替えます。 */
  function toggleCollapsed(taskId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  /** 状態フィルターの選択状態を切り替えます。 */
  function updateStatusFilter(status: TaskStatus) {
    setFilters((current) => ({
      ...current,
      statuses: {
        ...current.statuses,
        [status]: !current.statuses[status],
      },
    }));
  }

  /** 表示中のプロジェクトタブを切り替えます。 */
  function changeTab(tab: ViewTab) {
    setActiveTab(tab);
    clearTaskSelection();
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowHelpPage(false);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowProjectCreateSheet(false);
    setShowShortcutHelp(false);
  }

  /** 管理設定画面を開きます。 */
  function openMasterSettings() {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowHelpPage(false);
    setShowProjectCreateSheet(false);
    setShowProjectSettings(false);
    setShowShortcutHelp(false);
    setShowMasterSettings(true);
  }

  /** プロジェクト設定画面を開きます。 */
  function openProjectSettings() {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowHelpPage(false);
    setShowMasterSettings(false);
    setShowProjectCreateSheet(false);
    setShowShortcutHelp(false);
    setShowProjectSettings(true);
  }

  /** プロジェクト作成画面を開きます。 */
  function openProjectCreateSheet() {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowHelpPage(false);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowProjectCreateSheet(true);
  }

  /** 操作ヘルプ画面を開きます。 */
  function openHelpPage() {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowProjectCreateSheet(false);
    setShowShortcutHelp(false);
    closeTaskInspector();
    setShowHelpPage(true);
  }

  /** タスク詳細の指定項目へフォーカスします。 */
  function requestTaskInspectorFocus(taskId: string, target?: TaskInspectorFocusTarget) {
    openTaskInspector(taskId, target);
  }

  /** 別画面からタスクを選択してGanttへ移動します。 */
  function selectTaskFromSecondaryView(
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) {
    if (!taskId) return;
    if (projectId && projectId !== schedule.project.id) {
      const activated = activateProject(projectId);
      if (!activated) return;
    }
    selectOnlyTask(taskId);
    setActiveTab("Gantt");
    requestTaskInspectorFocus(taskId, focusTarget);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-task-id="${taskId}"]`)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    });
  }

  /** 健全性レポートの問題箇所を開きます。 */
  function openHealthIssue(issue: ScheduleHealthIssue) {
    if (issue.taskId) {
      selectTaskFromSecondaryView(issue.taskId, getHealthIssueFocusTarget(issue));
      return;
    }

    if (issue.category === "calendar") {
      changeTab("Calendar");
      return;
    }

    if (issue.category === "load") {
      changeTab("Resource");
      return;
    }

    if (issue.category === "assign") {
      changeTab("Gantt");
      openProjectSettings();
      return;
    }

    changeTab("Gantt");
  }

  /** プロジェクト設定をワークスペースへ反映します。 */
  function updateProjectSettings(project: Project) {
    setWorkspace((current) => ({
      ...current,
      projectSummaries: (current.projectSummaries ?? []).map((summary) =>
        summary.project.id === project.id ? { ...summary, project } : summary,
      ),
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === project.id ? { ...snapshot, project } : snapshot,
      ),
    }));
    setActiveTeamId(project.teamId);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    addToast({ detail: project.workspace, title: "プロジェクト設定を保存しました" });
    recordActivity({
      category: "project",
      detail: `${getOperationalProjectStatus(project)} / ${project.memberIds?.length ?? 0}名 / ${project.rangeStart} - ${project.rangeEnd}`,
      projectId: project.id,
      title: "プロジェクト設定を更新しました",
      tone: "success",
    });
  }

  /** プロジェクトのライフサイクル状態を更新します。 */
  function updateProjectLifecycleStatus(
    projectId: string,
    lifecycleStatus: ProjectLifecycleStatus,
  ) {
    const targetSchedule = workspace.schedules.find(
      (snapshot) => snapshot.project.id === projectId,
    );
    const targetSummary = projectSummaries.find((summary) => summary.project.id === projectId);
    const targetProject = targetSchedule?.project ?? targetSummary?.project;
    if (!targetProject) return;
    const nextProject = {
      ...targetProject,
      lifecycleStatus,
    };
    setWorkspace((current) => ({
      ...current,
      projectSummaries: (current.projectSummaries ?? []).map((summary) =>
        summary.project.id === projectId ? { ...summary, project: nextProject } : summary,
      ),
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === projectId
          ? {
              ...snapshot,
              project: nextProject,
            }
          : snapshot,
      ),
    }));
    addToast({
      detail: targetProject.workspace,
      title: `ステータスを${projectLifecycleLabels[lifecycleStatus]}に変更しました`,
      tone: lifecycleStatus === "completed" ? "success" : "info",
    });
    recordActivity({
      category: "project",
      detail: `${targetProject.workspace} を${projectLifecycleLabels[lifecycleStatus]}にしました。`,
      projectId,
      title: "プロジェクトステータスを更新しました",
      tone: lifecycleStatus === "completed" ? "success" : "info",
    });
  }

  /** プロジェクトをアーカイブします。 */
  function archiveProject(projectId: string) {
    const targetSchedule = workspace.schedules.find(
      (snapshot) => snapshot.project.id === projectId,
    );
    if (!targetSchedule) return;
    const fallbackSchedule =
      workspace.schedules.find(
        (snapshot) =>
          snapshot.project.id !== projectId &&
          snapshot.project.teamId === targetSchedule.project.teamId &&
          !isProjectArchived(snapshot.project),
      ) ??
      workspace.schedules.find(
        (snapshot) => snapshot.project.id !== projectId && !isProjectArchived(snapshot.project),
      );
    if (!fallbackSchedule) {
      addToast({
        detail: "最後の有効プロジェクトはアーカイブできません。",
        title: "アーカイブできません",
        tone: "warning",
      });
      return;
    }

    const archivedAt = new Date().toISOString();
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === projectId
          ? {
              ...snapshot,
              project: {
                ...snapshot.project,
                archivedAt,
                status: "archived",
              },
            }
          : snapshot,
      ),
    }));
    setFavoriteProjectIds((current) => {
      if (!current.has(projectId)) return current;
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
    setActiveTeamId(fallbackSchedule.project.teamId);
    setActiveProjectId(fallbackSchedule.project.id);
    persistNavigationState(fallbackSchedule.project.id, fallbackSchedule.project.teamId);
    writeProjectHash(fallbackSchedule.project.id, "replace");
    clearTaskSelection();
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowCreateSheet(false);
    setShowProjectCreateSheet(false);
    addToast({
      detail: `${targetSchedule.project.workspace} を一覧から外しました`,
      title: "プロジェクトをアーカイブしました",
      tone: "warning",
    });
    recordActivity({
      category: "project",
      detail: `${targetSchedule.project.workspace} をアーカイブしました。検索から復元できます。`,
      projectId,
      title: "プロジェクトをアーカイブしました",
      tone: "warning",
    });
  }

  /** アーカイブ済みプロジェクトを復元します。 */
  function restoreProject(projectId: string) {
    const targetSchedule = workspace.schedules.find(
      (snapshot) => snapshot.project.id === projectId,
    );
    if (!targetSchedule) return;
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) => {
        if (snapshot.project.id !== projectId) return snapshot;
        const { archivedAt: _archivedAt, status: _status, ...project } = snapshot.project;
        return {
          ...snapshot,
          project: {
            ...project,
            status: "active",
          },
        };
      }),
    }));
    setActiveTeamId(targetSchedule.project.teamId);
    setActiveProjectId(projectId);
    persistNavigationState(projectId, targetSchedule.project.teamId);
    writeProjectHash(projectId);
    clearTaskSelection();
    setActiveTab("Gantt");
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowCreateSheet(false);
    setShowProjectCreateSheet(false);
    addToast({
      detail: targetSchedule.project.workspace,
      title: "プロジェクトを復元しました",
      tone: "success",
    });
    recordActivity({
      category: "project",
      detail: `${targetSchedule.project.workspace} を有効プロジェクトに戻しました。`,
      projectId,
      title: "プロジェクトを復元しました",
      tone: "success",
    });
  }

  /** チームマスターを更新します。 */
  function updateTeam(team: Team) {
    setWorkspace((current) => ({
      ...current,
      teams: current.teams.map((item) => (item.id === team.id ? team : item)),
    }));
    addToast({ detail: team.name, title: "チーム設定を保存しました" });
    recordActivity({
      category: "team",
      detail: `${team.memberIds.length}名のメンバー構成`,
      title: "チーム設定を更新しました",
      tone: "success",
    });
  }

  /** チームマスターを追加します。 */
  function createTeam(team: Team) {
    setWorkspace((current) => ({
      ...current,
      teams: [...current.teams, team],
    }));
    addToast({ detail: team.name, title: "チームを追加しました" });
    recordActivity({
      category: "team",
      detail: team.description || `${team.memberIds.length}名`,
      title: `チームを追加: ${team.name}`,
      tone: "success",
    });
  }

  /** メンバー情報を更新します。 */
  function updateMember(member: Member) {
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) => ({
        ...snapshot,
        members: snapshot.members.map((item) => (item.id === member.id ? member : item)),
      })),
    }));
    recordActivity({
      category: "team",
      detail: `${member.role} / ${member.capacityHours}h / 休暇${
        member.availabilityOverrides?.length ?? 0
      }日`,
      title: `メンバーを更新: ${member.name}`,
      tone: "info",
    });
  }

  /** メンバーの有効・無効状態を更新します。 */
  function updateMemberLifecycle(memberId: string, status: "active" | "inactive") {
    const inactiveAt = status === "inactive" ? new Date().toISOString() : undefined;
    const member = schedule.members.find((item) => item.id === memberId);
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) => ({
        ...snapshot,
        members: snapshot.members.map((item) =>
          item.id === memberId
            ? {
                ...item,
                inactiveAt,
                status,
              }
            : item,
        ),
      })),
    }));
    addToast({
      detail: member?.name ?? memberId,
      title: status === "inactive" ? "メンバーを休止しました" : "メンバーを復帰しました",
      tone: status === "inactive" ? "warning" : "success",
    });
    recordActivity({
      category: "team",
      detail:
        status === "inactive"
          ? "新しい担当候補から外しました。既存の担当履歴は残ります。"
          : "新しい担当候補に戻しました。",
      title: `${status === "inactive" ? "メンバーを休止" : "メンバーを復帰"}: ${
        member?.name ?? memberId
      }`,
      tone: status === "inactive" ? "warning" : "success",
    });
  }

  /** メンバーを追加します。 */
  function createMember(member: Member, teamId: string | null) {
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) => ({
        ...snapshot,
        members: snapshot.members.some((item) => item.id === member.id)
          ? snapshot.members
          : [...snapshot.members, member],
      })),
      teams:
        teamId == null
          ? current.teams
          : current.teams.map((team) =>
              team.id === teamId
                ? {
                    ...team,
                    memberIds: team.memberIds.includes(member.id)
                      ? team.memberIds
                      : [...team.memberIds, member.id],
                  }
                : team,
            ),
    }));
    addToast({ detail: member.name, title: "メンバーを追加しました" });
    recordActivity({
      category: "team",
      detail: `${member.role} / ${member.capacityHours}h / 休暇${
        member.availabilityOverrides?.length ?? 0
      }日`,
      title: `メンバーを追加: ${member.name}`,
      tone: "success",
    });
  }

  /** チームとメンバーの所属を切り替えます。 */
  function toggleTeamMember(teamId: string, memberId: string, enabled: boolean) {
    setWorkspace((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) return team;
        return {
          ...team,
          memberIds: enabled
            ? Array.from(new Set([...team.memberIds, memberId]))
            : team.memberIds.filter((id) => id !== memberId),
        };
      }),
    }));
    const member = schedule.members.find((item) => item.id === memberId);
    recordActivity({
      category: "team",
      detail: `${member?.name ?? memberId} を${enabled ? "チームに追加" : "チームから外し"}ました。`,
      title: "チーム所属を更新しました",
      tone: "info",
    });
  }

  /** チームの標準カレンダーを更新します。 */
  function updateTeamCalendarMaster(calendar: CalendarDefinition) {
    const teamId = activeTeam.id;
    const targetProjectCount = workspace.schedules.filter(
      (snapshot) => snapshot.project.teamId === teamId,
    ).length;
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.teamId === teamId ? { ...snapshot, calendar } : snapshot,
      ),
    }));
    addToast({
      detail: `${activeTeam.name} / ${targetProjectCount}件`,
      title: "チーム標準カレンダーを保存しました",
    });
    recordActivity({
      category: "calendar",
      detail: `${activeTeam.name} / 稼働曜日 ${calendar.workWeek.length}件 / 休日 ${calendar.holidays.length}件`,
      title: "チーム標準カレンダーを更新しました",
      tone: "info",
    });
  }

  /** 案件カレンダーを更新します。 */
  function updateCalendar(calendar: CalendarDefinition) {
    const projectId = schedule.project.id;
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === projectId ? { ...snapshot, calendar } : snapshot,
      ),
    }));
    recordActivity({
      category: "calendar",
      detail: `稼働曜日 ${calendar.workWeek.length}件 / 休日 ${calendar.holidays.length}件`,
      title: "カレンダーを更新しました",
      tone: "info",
    });
  }

  /** 指定プロジェクトを読み込み、現在案件として切り替えます。 */
  function activateProject(
    projectId: string,
    options: { historyMode?: "push" | "replace"; updateHash?: boolean } = {},
  ) {
    const nextSchedule = workspace.schedules.find((snapshot) => snapshot.project.id === projectId);
    const summaryProject = projectSummaries.find(
      (summary) => summary.project.id === projectId,
    )?.project;
    const nextProject = nextSchedule?.project ?? summaryProject;
    if (!nextProject) return false;
    if (isProjectArchived(nextProject)) {
      addToast({
        detail: nextProject.workspace,
        title: "アーカイブ済みプロジェクトです",
        tone: "warning",
      });
      return false;
    }
    const requestId = projectLoadRequestIdRef.current + 1;
    projectLoadRequestIdRef.current = requestId;

    const completeActivation = (loadedSchedule: ScheduleSnapshot) => {
      if (projectLoadRequestIdRef.current !== requestId) return;
      setWorkspace((current) => mergeScheduleIntoWorkspace(current, loadedSchedule));
      initializeProject(projectId, loadedSchedule.tasks);
      setActiveTeamId(loadedSchedule.project.teamId);
      setActiveProjectId(loadedSchedule.project.id);
      persistNavigationState(loadedSchedule.project.id, loadedSchedule.project.teamId);
      clearTaskSelection();
      setPendingTaskCsvImport(null);
      setPendingProjectImport(null);
      setShowCreateSheet(false);
      setShowProjectCreateSheet(false);
      setShowShortcutHelp(false);
      if (options.updateHash !== false) {
        writeProjectHash(loadedSchedule.project.id, options.historyMode ?? "push");
      }
      setLoadingProjectId(null);
    };

    if (!nextSchedule) {
      if (loadingProjectId === projectId) return true;
      setLoadingProjectId(projectId);
      apiScheduleRepository
        .getProjectSchedule(projectId)
        .then(completeActivation)
        .catch((error: unknown) => {
          if (projectLoadRequestIdRef.current !== requestId) return;
          setLoadingProjectId(null);
          addToast({
            detail: error instanceof Error ? error.message : "案件詳細を取得できませんでした。",
            title: "プロジェクトを開けませんでした",
            tone: "warning",
          });
        });
      return true;
    }

    completeActivation(nextSchedule);
    return true;
  }

  /** 選択チームと表示案件を切り替えます。 */
  function changeTeam(teamId: string, options: { stayOnPortfolio?: boolean } = {}) {
    const firstProject = projectSummaries.find(
      (summary) => summary.project.teamId === teamId && !isProjectArchived(summary.project),
    )?.project;
    if (firstProject) {
      activateProject(firstProject.id, { updateHash: !options.stayOnPortfolio });
      if (options.stayOnPortfolio) {
        setActiveTab("Projects");
        setShowMasterSettings(false);
        setShowProjectSettings(false);
      }
      return;
    }
    setActiveTeamId(teamId);
    setActiveTab("Projects");
    clearTaskSelection();
    setPendingTaskCsvImport(null);
    setPendingProjectImport(null);
    setShowCreateSheet(false);
    setShowProjectCreateSheet(false);
    setShowMasterSettings(false);
    setShowProjectSettings(false);
    setShowShortcutHelp(false);
    persistNavigationState(activeProjectId, teamId);
  }

  /** 指定プロジェクトへ移動します。 */
  function changeProject(projectId: string) {
    return activateProject(projectId);
  }

  /** テンプレートからプロジェクトを作成します。 */
  function createProject(input: CreateProjectTemplateInput) {
    const activeTeamMemberIds = new Set(activeTeam?.memberIds ?? []);
    const templateMembers = getActiveMembers(schedule.members).filter((member) =>
      activeTeamMemberIds.has(member.id),
    );
    const nextSchedule = createProjectFromTemplate({
      calendar: schedule.calendar,
      includeCalendar: calendarAware,
      members: templateMembers.length > 0 ? templateMembers : schedule.members,
      projectIndex: nextProjectIndex,
      projectName: input.projectName,
      startDate: input.startDate,
      teamId: activeTeamId,
      templateId: input.templateId,
      workspace: input.workspace,
    });
    const nextSummary = createProjectSummaryFromSnapshot(nextSchedule);
    setWorkspace((current) => ({
      ...current,
      projectSummaries: [...(current.projectSummaries ?? []), nextSummary],
      schedules: [...current.schedules, nextSchedule],
    }));
    replaceProject(nextSchedule.project.id, nextSchedule.tasks);
    setActiveTeamId(nextSchedule.project.teamId);
    setActiveProjectId(nextSchedule.project.id);
    writeProjectHash(nextSchedule.project.id);
    selectOnlyTask(nextSchedule.tasks[0]?.id ?? null);
    setCollapsedIdsForProject(nextSchedule.project.id, new Set());
    setActiveTab("Gantt");
    setPendingTaskCsvImport(null);
    setPendingProjectImport(null);
    setShowProjectCreateSheet(false);
    addToast({
      detail: `${nextSchedule.project.workspace} / ${nextSchedule.tasks.length}行`,
      title: "プロジェクトを追加しました",
    });
    recordActivity({
      category: "project",
      detail: `${activeTeam?.name ?? activeTeamId} に${nextSchedule.tasks.length}行のプロジェクトを作成しました。`,
      projectId: nextSchedule.project.id,
      title: "プロジェクトを追加しました",
      tone: "success",
    });
  }

  /** プロジェクトのお気に入り状態を切り替えます。 */
  function toggleFavoriteProject(projectId = schedule.project.id) {
    const targetProject =
      workspace.schedules.find((snapshot) => snapshot.project.id === projectId)?.project ??
      projectSummaries.find((summary) => summary.project.id === projectId)?.project ??
      schedule.project;
    const willFavorite = !favoriteProjectIds.has(projectId);
    setFavoriteProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
    addToast({
      detail: targetProject.workspace,
      title: willFavorite ? "お気に入りに追加しました" : "お気に入りから外しました",
      tone: "info",
    });
    recordActivity({
      category: "project",
      detail: willFavorite
        ? "プロジェクトをお気に入りに追加しました。"
        : "プロジェクトをお気に入りから外しました。",
      projectId,
      title: "お気に入りを更新しました",
      tone: "info",
    });
  }

  /** プロジェクトデータを指定形式で出力します。 */
  function exportProject(format: ExportFormat) {
    const exportDate = new Date().toISOString().slice(0, 10);
    const fileBase = `${schedule.project.workspace}-${exportDate}`;
    if (format === "json") {
      downloadTextFile(
        `${fileBase}.json`,
        JSON.stringify(
          {
            calendar: schedule.calendar,
            members: schedule.members,
            project: schedule.project,
            tasks,
            team: activeTeam,
          },
          null,
          2,
        ),
        "application/json",
      );
      addToast({ detail: `${fileBase}.json`, title: "JSONを書き出しました" });
      recordActivity({
        category: "import",
        detail: `${fileBase}.json`,
        title: "プロジェクトJSONを書き出しました",
        tone: "info",
      });
      return;
    }

    const header = [
      "ID",
      "親ID",
      "種別",
      "タスク名",
      "状態",
      "開始日",
      "終了日",
      "進捗",
      "担当者",
      "工数",
      "依存",
    ];
    const rows = tasks.map((task) => [
      task.id,
      task.parentId ?? "",
      task.type,
      task.title,
      task.status,
      task.start,
      task.end,
      String(task.progress),
      task.assigneeIds
        .map((id) => schedule.members.find((member) => member.id === id)?.name ?? id)
        .join(" / "),
      task.effortHours != null ? String(task.effortHours) : "",
      (task.dependencies ?? []).join(" / "),
    ]);
    downloadTextFile(
      `${fileBase}.csv`,
      [header, ...rows].map((row) => row.map((value) => escapeCsv(value)).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
    addToast({ detail: `${fileBase}.csv`, title: "CSVを書き出しました" });
    recordActivity({
      category: "import",
      detail: `${fileBase}.csv`,
      title: "タスク一覧CSVを書き出しました",
      tone: "info",
    });
  }

  async function importProject(file: File) {
    try {
      const imported = parseProjectImportJson(await file.text());
      setPendingProjectImport({
        data: imported,
        fileName: file.name,
        validation: validateProjectImportData(imported),
      });
      setPendingTaskCsvImport(null);
      setShowMasterSettings(false);
      setShowProjectSettings(false);
      setShowCreateSheet(false);
      setShowProjectCreateSheet(false);
      setShowShortcutHelp(false);
    } catch (error) {
      addToast({
        detail:
          error instanceof ProjectImportError || error instanceof Error
            ? error.message
            : "ファイルの内容を確認してください。",
        title: "JSONを読み込めませんでした",
        tone: "warning",
      });
    }
  }

  async function importTaskCsv(file: File) {
    try {
      const draft = createTaskCsvImportDraft(await file.text());
      setPendingTaskCsvImport(createPendingTaskCsvImport(file.name, draft));
      setPendingProjectImport(null);
      setShowMasterSettings(false);
      setShowProjectSettings(false);
      setShowCreateSheet(false);
      setShowProjectCreateSheet(false);
      setShowShortcutHelp(false);
    } catch (error) {
      addToast({
        detail:
          error instanceof ProjectImportError || error instanceof Error
            ? error.message
            : "ファイルの内容を確認してください。",
        title: "CSVを読み込めませんでした",
        tone: "warning",
      });
    }
  }

  async function importBrabioXlsx(file: File) {
    try {
      const result = await createBrabioXlsxImportDraft(file);
      setPendingTaskCsvImport(
        createPendingTaskCsvImport(file.name, result.draft, {
          membersToCreate: result.members,
          sourceKind: "brabio",
          warnings: result.warnings,
        }),
      );
      setPendingProjectImport(null);
      setShowMasterSettings(false);
      setShowProjectSettings(false);
      setShowCreateSheet(false);
      setShowProjectCreateSheet(false);
      setShowShortcutHelp(false);
    } catch (error) {
      addToast({
        detail:
          error instanceof ProjectImportError || error instanceof Error
            ? error.message
            : "ファイルの内容を確認してください。",
        title: "Brabio XLSXを読み込めませんでした",
        tone: "warning",
      });
    }
  }

  /** 取込ファイルを解析し、確認用の保留データを作成します。 */
  function createPendingTaskCsvImport(
    fileName: string,
    draft: TaskCsvImportDraft,
    options: {
      membersToCreate?: Member[];
      sourceKind?: "brabio" | "csv";
      warnings?: string[];
    } = {},
  ): PendingTaskCsvImport {
    const sourceKind = options.sourceKind ?? "csv";
    const membersToCreate = dedupeImportMembers(options.membersToCreate ?? []);
    const importMembers = [...schedule.members, ...membersToCreate];
    const sourceWarnings = options.warnings ?? [];
    try {
      const imported = parseTaskCsvImportFromDraft(draft, {
        members: importMembers,
      });
      const validation = validateTaskCsvImportData(imported, {
        calendar: schedule.calendar,
        members: importMembers,
        project: schedule.project,
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

  /** 取込メンバーの重複を除去します。 */
  function dedupeImportMembers(members: Member[]) {
    const existingIds = new Set(schedule.members.map((member) => member.id));
    const nextMembers: Member[] = [];
    const nextIds = new Set<string>();
    members.forEach((member) => {
      if (existingIds.has(member.id) || nextIds.has(member.id)) return;
      nextIds.add(member.id);
      nextMembers.push(member);
    });
    return nextMembers;
  }

  /** 文字列配列の重複を除去します。 */
  function uniqueStrings(values: string[]) {
    return [...new Set(values)];
  }

  /** 担当者未設定の警告が任意項目か判定します。 */
  function isOptionalAssigneeWarning(message: string) {
    return message.endsWith("に担当者が設定されていません。");
  }

  /** 取込データに必要なメンバーを追加します。 */
  function addMissingMembers(currentMembers: Member[], membersToCreate: Member[]) {
    if (membersToCreate.length === 0) return currentMembers;
    const currentIds = new Set(currentMembers.map((member) => member.id));
    const additions = membersToCreate.filter((member) => !currentIds.has(member.id));
    return additions.length === 0 ? currentMembers : [...currentMembers, ...additions];
  }

  /** 取込元の表示名を返します。 */
  function getTaskImportSourceLabel(sourceKind: PendingTaskCsvImport["sourceKind"]) {
    return sourceKind === "brabio" ? "Brabio XLSX" : "タスクCSV";
  }

  /** 取込確認画面の列対応を更新します。 */
  function updatePendingTaskCsvMapping(mapping: TaskCsvImportMapping) {
    setPendingTaskCsvImport((current) => {
      if (!current) return current;
      return createPendingTaskCsvImport(
        current.fileName,
        {
          ...current.draft,
          mapping,
        },
        {
          membersToCreate: current.membersToCreate,
          sourceKind: current.sourceKind,
          warnings: current.sourceWarnings,
        },
      );
    });
  }

  /** 確認済みのタスク取込を案件へ反映します。 */
  function applyPendingTaskCsvImport(options: TaskCsvImportOptions) {
    if (!pendingTaskCsvImport) return;
    if (pendingTaskCsvImport.validation.errors.length > 0 || pendingTaskCsvImport.data === null) {
      addToast({
        detail: "インポート確認のエラーを解消してください。",
        title: `${getTaskImportSourceLabel(pendingTaskCsvImport.sourceKind)}を読み込めませんでした`,
        tone: "warning",
      });
      return;
    }

    const sourceLabel = getTaskImportSourceLabel(pendingTaskCsvImport.sourceKind);
    const membersToCreate = pendingTaskCsvImport.membersToCreate;
    const nextTasks = normalizeSummaryTasks(pendingTaskCsvImport.data.tasks);
    const csvRange = getTaskRange(nextTasks, schedule.project);
    const shouldExpandProjectRange =
      options.expandProjectRange &&
      csvRange !== null &&
      (csvRange.start !== schedule.project.rangeStart ||
        csvRange.end !== schedule.project.rangeEnd);
    const nextProject =
      shouldExpandProjectRange && csvRange
        ? {
            ...schedule.project,
            rangeEnd: csvRange.end,
            rangeStart: csvRange.start,
          }
        : schedule.project;
    commitTasks(() => nextTasks);
    if (nextProject !== schedule.project || membersToCreate.length > 0) {
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.id === schedule.project.id
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
            ? current.teams
            : current.teams.map((team) =>
                team.id === activeTeam.id
                  ? {
                      ...team,
                      memberIds: uniqueStrings([
                        ...team.memberIds,
                        ...membersToCreate.map((member) => member.id),
                      ]),
                    }
                  : team,
              ),
      }));
    }
    setActiveTab("Gantt");
    setCollapsedIds(new Set());
    selectOnlyTask(nextTasks[0]?.id ?? null);
    setPendingTaskCsvImport(null);
    addToast({
      detail:
        nextProject !== schedule.project
          ? `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行 / 期間拡張`
          : `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行`,
      title: `${sourceLabel}を取り込みました`,
      tone: "info",
    });
    recordActivity({
      category: "import",
      detail:
        nextProject !== schedule.project
          ? `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行を反映し、プロジェクト期間を${nextProject.rangeStart} - ${nextProject.rangeEnd}へ広げました。`
          : `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行を${schedule.project.workspace}へ反映しました。`,
      title: `${sourceLabel}を取り込みました`,
      tone: "success",
    });
  }

  /** 確認済みのプロジェクト取込をワークスペースへ反映します。 */
  function applyPendingProjectImport(mode: ProjectImportMode) {
    if (!pendingProjectImport) return;
    if (pendingProjectImport.validation.errors.length > 0) {
      addToast({
        detail: "インポート確認のエラーを解消してください。",
        title: "JSONを読み込めませんでした",
        tone: "warning",
      });
      return;
    }

    const imported = pendingProjectImport.data;
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
    const teamExists = existingTeamIds.has(importedTeamId);
    const nextTeamId = teamExists
      ? importedTeamId
      : imported.team
        ? createUniqueImportedId(imported.team.id, existingTeamIds)
        : (existingSchedule?.project.teamId ?? activeTeamId);
    const nextTeam =
      imported.team && !teamExists
        ? {
            ...imported.team,
            id: nextTeamId,
          }
        : null;
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

    setWorkspace((current) => ({
      ...current,
      schedules: replaceExisting
        ? current.schedules.map((snapshot) =>
            snapshot.project.id === importedProjectId ? nextSchedule : snapshot,
          )
        : [...current.schedules, nextSchedule],
      teams: nextTeam ? [...current.teams, nextTeam] : current.teams,
    }));
    replaceProject(importedProjectId, nextTasks);
    setFavoriteProjectIds((current) => {
      if (!replaceExisting || !projectIdChanged) return current;
      const next = new Set(current);
      next.delete(imported.project.id);
      return next;
    });
    setActiveTeamId(nextTeamId);
    setActiveProjectId(importedProjectId);
    writeProjectHash(importedProjectId);
    setActiveTab("Gantt");
    setCollapsedIdsForProject(importedProjectId, new Set());
    clearTaskSelection();
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    addToast({
      detail: `${nextSchedule.project.workspace} / ${pendingProjectImport.fileName}`,
      title: replaceExisting ? "プロジェクトを上書きしました" : "JSONを読み込みました",
      tone: "info",
    });
    recordActivity({
      category: "import",
      detail: `${pendingProjectImport.fileName} / ${nextTasks.length}行`,
      projectId: importedProjectId,
      title: replaceExisting ? "プロジェクトを上書きしました" : "JSONを読み込みました",
      tone: "success",
    });
  }

  /** 現在の変更をローカル保存し、API同期を開始します。 */
  function saveDraft(draft = currentDraftRef.current) {
    const projectScopedSave = isProjectSaveScope;
    const apiChangeCount = Math.max(
      taskChangeReviewRef.current.totalCount + configChangeReviewRef.current.totalCount,
      hasUnsavedChangesRef.current ? 1 : 0,
      1,
    );
    const entry = createActivityEntry({
      category: "sync",
      detail: projectScopedSave
        ? `${schedule.project.workspace} のガントをこのブラウザに保存しました。`
        : `${saveScopeLabel}をこのブラウザに保存しました。`,
      title: projectScopedSave ? "ガントを保存しました" : "ローカル保存しました",
      tone: "success",
    });
    const nextActivityLogs = appendActivityLogEntry(activityLogsRef.current, entry);
    const draftWithActivity = {
      ...draft,
      activityLogs: nextActivityLogs,
    };
    const nextDraft = projectScopedSave
      ? mergeProjectScopedSavedDraft(savedDraftRef.current, draftWithActivity, schedule.project.id)
      : draftWithActivity;
    const saved = saveLocalScheduleDraft(nextDraft);
    savedDraftRef.current = nextDraft;
    setShowSaveReview(false);
    setActivityLogSnapshot(nextActivityLogs);
    setLastSavedAt(saved.savedAt);
    setSavedSignature(createDraftSignature(nextDraft));
    setSavedWorkspace(nextDraft.workspace);
    addToast({
      detail: projectScopedSave ? schedule.project.workspace : saveScopeLabel,
      title: projectScopedSave ? "このガントを保存しました" : "ローカル保存しました",
    });
    void scheduleApiSync(nextDraft, apiChangeCount);
  }

  /** 保存要求をキューに登録します。 */
  function requestSaveDraft() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSaveRequestId((value) => value + 1);
  }

  /** ローカル下書きを破棄して再読み込みします。 */
  function resetDraft() {
    clearLocalScheduleDraft();
    setShowResetConfirm(false);
    onReloadWorkspace();
  }

  useGanttKeyboardShortcuts({
    activeTab,
    filterOpen,
    getTaskTitle: (taskId) => tasks.find((task) => task.id === taskId)?.title,
    hasTaskClipboard: Boolean(taskClipboardRef.current || taskClipboard),
    onChangeTab: changeTab,
    onClearTaskSelection: clearTaskSelection,
    onCloseCreateSheet: () => setShowCreateSheet(false),
    onCloseFilter: () => setFilterOpen(false),
    onCloseProjectCreateSheet: () => setShowProjectCreateSheet(false),
    onCloseProjectImport: () => {
      setPendingProjectImport(null);
      setPendingTaskCsvImport(null);
    },
    onCloseResetConfirm: () => setShowResetConfirm(false),
    onCloseSaveReview: () => setShowSaveReview(false),
    onCloseShortcutHelp: () => setShowShortcutHelp(false),
    onCloseTaskInspector: closeTaskInspector,
    onCopyTask: taskActions.copySelectedTask,
    onDeleteSelectedTasks: taskActions.deleteSelectedTasks,
    onDuplicateTask: taskActions.duplicateSelectedTask,
    onFocusSearch: () => {
      const input = document.querySelector<HTMLInputElement>('[data-command="task-search"]');
      input?.focus();
      input?.select();
    },
    onFocusSelectedTitle: () => {
      if (selectedTaskId) focusTaskTitleEditor(selectedTaskId);
    },
    onFocusTaskStart: () => setTaskStartFocusSignal((value) => value + 1),
    onIndentSelectedTasks: taskActions.indentSelectedTasks,
    onInsertTaskAbove: taskActions.insertTaskAbove,
    onInsertTaskBelow: taskActions.insertTaskBelow,
    onMoveSelectedTask: taskActions.moveSelectedTaskWithinSiblings,
    onOpenShortcutHelp: () => setShowShortcutHelp(true),
    onOutdentSelectedTasks: taskActions.outdentSelectedTasks,
    onPasteTask: taskActions.pasteCopiedTask,
    onRedo: redo,
    onRequestSave: requestSaveDraft,
    onSelectAllVisibleTasks: () => selectTaskIds(visibleRows.map((row) => row.id)),
    onSelectOnlyTask: selectOnlyTask,
    onSelectTask: selectTask,
    onSetCreateSheetOpen: () => setShowCreateSheet(true),
    onSetFilterOpen: setFilterOpen,
    onSetTimeUnit: setTimeUnit,
    onShiftSelectedTasks: taskActions.shiftSelectedTasksByDays,
    onShowToday: () => setTodaySignal((value) => value + 1),
    onUndo: undo,
    pendingProjectImport: pendingProjectImport != null,
    pendingTaskCsvImport: pendingTaskCsvImport != null,
    selectedTaskId,
    selectedTaskIds,
    selectionAnchorTaskId,
    showCreateSheet,
    showHelpPage,
    showProjectCreateSheet,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
    taskInspectorTaskId,
    visibleRows,
  });

  useEffect(() => {
    if (saveRequestId === 0) return;
    const timeoutId = window.setTimeout(() => {
      if (
        hasUnsavedChangesRef.current &&
        (taskChangeReviewRef.current.totalCount > 0 || configChangeReviewRef.current.totalCount > 0)
      ) {
        setShowSaveReview(true);
        return;
      }
      saveDraft(currentDraftRef.current);
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [saveRequestId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const activeFilterCount =
    Object.values(filters.statuses).filter(Boolean).length + (filters.assigneeId !== "all" ? 1 : 0);
  const nextProjectIndex =
    projectSummaries.filter(
      (summary) => summary.project.teamId === activeTeamId && !isProjectArchived(summary.project),
    ).length + 1;
  const importExistingProject = pendingProjectImport
    ? (projectSummaries.find(
        (summary) => summary.project.id === pendingProjectImport.data.project.id,
      )?.project ?? null)
    : null;
  const showMainProjectViews = !showMasterSettings && !showProjectSettings && !showHelpPage;

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        helpOpen={showHelpPage}
        onHelp={openHelpPage}
        onMasterSettingsOpen={openMasterSettings}
        onNavigate={changeTab}
        onProjectSettingsOpen={openProjectSettings}
        projectName={schedule.project.workspace}
        projectNavigationVisible={
          !showMasterSettings && !showHelpPage && (showProjectSettings || activeTab !== "Projects")
        }
        projectSettingsOpen={showProjectSettings}
        settingsOpen={showMasterSettings}
      />
      <main className="workspace">
        {loadingProjectId || teamResourcesLoading ? (
          <div className="project-loading-indicator" role="status">
            <span className="loading-spinner" />
            {teamResourcesLoading ? "チーム案件を読み込み中..." : "案件詳細を読み込み中..."}
          </div>
        ) : null}
        <Topbar
          activeTeamId={activeTeamId}
          allProjects={workspaceProjects}
          apiConnectionMode={apiConnectionMode}
          contextMode={
            showHelpPage
              ? "help"
              : showMasterSettings
                ? "admin"
                : activeTab === "Projects"
                  ? "portfolio"
                  : "project"
          }
          currentUser={currentUser}
          favorite={favoriteProjectIds.has(schedule.project.id)}
          favoriteProjectIds={favoriteProjectIds}
          hasUnsavedChanges={hasUnsavedChanges}
          notifications={topbarNotifications}
          onApiConnectionModeChange={changeApiConnectionMode}
          onExportProject={exportProject}
          onImportBrabioXlsx={importBrabioXlsx}
          onFavoriteToggle={toggleFavoriteProject}
          onImportProject={importProject}
          onImportTaskCsv={importTaskCsv}
          onRetryApiSync={retryApiSync}
          onProjectLinkCopy={(copied) =>
            addToast({
              detail: copied ? schedule.project.workspace : "リンク欄を選択してコピーしてください",
              title: copied ? "共有リンクをコピーしました" : "自動コピーできませんでした",
              tone: copied ? "success" : "warning",
            })
          }
          onProjectChange={changeProject}
          onProjectRestore={restoreProject}
          onProjectSettingsOpen={openProjectSettings}
          projectSettingsOpen={showProjectSettings}
          onResetDraft={() => setShowResetConfirm(true)}
          onSaveDraft={requestSaveDraft}
          onLogout={onLogout}
          onTeamChange={changeTeam}
          project={schedule.project}
          projects={activeTeamProjects}
          syncQueueItems={syncQueueItems}
          syncStatus={syncStatus}
          teams={workspace.teams}
        />
        <Suspense fallback={<ViewLoading label="ビューを読み込み中" />}>
          {showMasterSettings ? (
            <MasterSettingsPage
              activeTeamProjectCount={activeTeamReviewSchedules.length}
              baseDate={schedule.project.rangeStart}
              calendar={schedule.calendar}
              memberAssignmentCounts={memberAssignmentCounts}
              members={schedule.members}
              onCreateMember={createMember}
              onCreateTeam={createTeam}
              onSaveCalendar={updateTeamCalendarMaster}
              onSaveMember={updateMember}
              onSaveTeam={updateTeam}
              onToggleTeamMember={toggleTeamMember}
              onUpdateMemberLifecycle={updateMemberLifecycle}
              team={activeTeam}
              teams={workspace.teams}
            />
          ) : null}
          {showProjectSettings ? (
            <ProjectSettingsPage
              activeProjectCount={activeProjectCount}
              members={schedule.members}
              onArchiveProject={archiveProject}
              onSaveProject={updateProjectSettings}
              project={schedule.project}
              team={activeTeam}
              teams={workspace.teams}
            />
          ) : null}
          {showHelpPage ? <HelpPage /> : null}
          {showMainProjectViews && activeTab === "Gantt" ? (
            <GanttWorkbench
              activeFilterCount={activeFilterCount}
              calendarAware={calendarAware}
              columnVisibility={columnVisibility}
              collapsedIds={collapsedIds}
              filterOpen={filterOpen}
              filters={filters}
              members={projectMembers}
              months={ganttColumns.primary}
              canPasteTask={taskClipboard !== null}
              onAssigneeChange={(assigneeId) =>
                setFilters((current) => ({ ...current, assigneeId }))
              }
              onBulkAssigneeChange={taskActions.bulkUpdateSelectedAssignee}
              onBulkDateShift={taskActions.shiftSelectedTasksByDays}
              onBulkStatusChange={taskActions.bulkUpdateSelectedStatus}
              onCalendarAwareChange={setCalendarAware}
              onColumnVisibilityChange={setColumnVisibility}
              onCopyTask={taskActions.copySelectedTask}
              onCreateTask={() => setShowCreateSheet(true)}
              onDeleteTask={taskActions.deleteSelectedTasks}
              onDuplicateTask={taskActions.duplicateSelectedTask}
              onFilterOpenChange={setFilterOpen}
              onFilterReset={() => setFilters(initialFilters)}
              onIndentTasks={taskActions.indentSelectedTasks}
              onQueryChange={(query) =>
                setFilters((current) => ({
                  ...current,
                  query,
                }))
              }
              onMoveTask={taskActions.moveTask}
              onReorderTasks={taskActions.moveSelectedTaskWithinSiblings}
              onReorderTasksToTarget={taskActions.moveSelectedTasksToSiblingPosition}
              onReparentTasksByDrag={taskActions.moveSelectedTasksToParentPosition}
              onOpenTaskInspector={openTaskInspector}
              onOutdentTasks={taskActions.outdentSelectedTasks}
              onPasteTask={taskActions.pasteCopiedTask}
              onResizeTask={taskActions.resizeTask}
              onSelectTask={selectTask}
              onSelectTaskRange={selectTaskRange}
              onScaleChange={setScale}
              onShortcutHelp={() => setShowShortcutHelp(true)}
              onStatusToggle={updateStatusFilter}
              onTimeUnitChange={setTimeUnit}
              onToday={() => setTodaySignal((value) => value + 1)}
              onToggleCollapsed={toggleCollapsed}
              onUpdateTask={taskActions.updateTask}
              rows={visibleRows}
              scale={scale}
              selectedTaskCount={selectedTaskIds.size}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              tasks={tasks}
              taskStartFocusSignal={taskStartFocusSignal}
              timeUnit={timeUnit}
              displayMode={ganttDisplayMode}
              onDisplayModeChange={setGanttDisplayMode}
              timeline={timeline}
              todaySignal={todaySignal}
              weeks={ganttColumns.secondary}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Status" ? (
            <SummaryStrip
              calendar={schedule.calendar}
              calendarAware={calendarAware}
              members={projectMembers}
              healthReport={healthReport}
              onOpenHealthIssue={openHealthIssue}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
              resourceRows={resourceRows}
              stats={stats}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Issues" ? (
            <ProjectIssuePanel
              currentUser={currentUser}
              issues={activeIssues}
              members={projectMembers}
              onCreateIssue={createProjectIssue}
              onSelectTask={(taskId) => selectTaskFromSecondaryView(taskId)}
              onUpdateIssue={updateProjectIssue}
              project={schedule.project}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "WorkLogs" ? (
            <WorkLogPanel
              currentUser={currentUser}
              issues={activeIssues}
              members={projectMembers}
              onCreateWorkLog={createProjectWorkLog}
              onDeleteWorkLog={deleteProjectWorkLog}
              onSelectTask={(taskId) => selectTaskFromSecondaryView(taskId)}
              onUpdateWorkLog={updateProjectWorkLog}
              project={schedule.project}
              tasks={tasks}
              workLogs={activeWorkLogs}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Projects" ? (
            <ProjectPortfolioPanel
              activeProjectId={schedule.project.id}
              activeTeamId={activeTeamId}
              calendarAware={calendarAware}
              favoriteProjectIds={favoriteProjectIds}
              onCreateProject={openProjectCreateSheet}
              onOpenProject={(projectId) => {
                if (changeProject(projectId)) {
                  setActiveTab("Gantt");
                }
              }}
              onSelectProject={(projectId) => {
                changeProject(projectId);
              }}
              onTeamChange={(teamId) => changeTeam(teamId, { stayOnPortfolio: true })}
              onToggleFavoriteProject={toggleFavoriteProject}
              onUpdateProjectLifecycleStatus={updateProjectLifecycleStatus}
              projectSummaries={projectSummaries}
              schedules={currentReviewSchedules}
              teams={workspace.teams}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Resource" ? (
            <ResourcePanel
              displaySettings={resourceDisplaySettings}
              onDisplaySettingsChange={setResourceDisplaySettings}
              onMoveTask={taskActions.moveTask}
              onScopeChange={setResourceScope}
              onSelectTask={selectTaskFromSecondaryView}
              onShareTask={taskActions.shareTaskWithMember}
              resourceRows={displayedResourceRows}
              scope={resourceScope}
              scopeDescription={
                resourceScope === "team"
                  ? `${activeTeam?.name ?? "選択チーム"} / ${
                      activeTeamReviewSchedules.length
                    }案件を横断`
                  : `${schedule.project.workspace} / メンバー別週キャパシティ基準`
              }
              scopeLabel={resourceScope === "team" ? "チーム横断" : "このプロジェクト"}
              weeks={displayedResourceWeeks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Calendar" ? (
            <CalendarPanel
              calendar={schedule.calendar}
              onCalendarChange={updateCalendar}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Milestones" ? (
            <MilestonePanel
              members={projectMembers}
              onCreateMilestone={taskActions.createMilestone}
              onSelectTask={selectTaskFromSecondaryView}
              onUpdateTask={taskActions.updateTask}
              project={schedule.project}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Activity" ? (
            <ActivityPanel
              changeReview={taskChangeReview}
              configReview={configChangeReview}
              entries={activeActivityEntries}
              hasUnsavedChanges={hasUnsavedChanges}
              onSaveDraft={requestSaveDraft}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
            />
          ) : null}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {showMainProjectViews && activeTab === "Gantt" ? (
          <TaskInspector
            calendar={schedule.calendar}
            calendarAware={calendarAware}
            focusRequest={taskFocusRequest}
            members={projectMembers}
            onClose={closeTaskInspector}
            onMoveTask={taskActions.moveTask}
            onTaskActivity={(taskId, title, detail, tone = "info") =>
              recordActivity({
                category: "task",
                detail,
                taskId,
                title,
                tone,
              })
            }
            onResizeTask={taskActions.resizeTask}
            onSetTaskDates={taskActions.setTaskDates}
            onUpdateTask={taskActions.updateTask}
            tasks={tasks}
            task={taskInspectorTask}
          />
        ) : null}
        {showProjectCreateSheet ? (
          <ProjectCreateSheet
            defaultStartDate={schedule.project.rangeStart}
            nextProjectIndex={nextProjectIndex}
            onClose={() => setShowProjectCreateSheet(false)}
            onCreateProject={createProject}
            team={activeTeam}
          />
        ) : null}
        {pendingProjectImport ? (
          <ProjectImportSheet
            existingProject={importExistingProject}
            fileName={pendingProjectImport.fileName}
            imported={pendingProjectImport.data}
            onClose={() => setPendingProjectImport(null)}
            onImport={applyPendingProjectImport}
            validation={pendingProjectImport.validation}
          />
        ) : null}
        {pendingTaskCsvImport?.sourceKind === "brabio" ? (
          <BrabioTaskImportSheet
            fileName={pendingTaskCsvImport.fileName}
            imported={pendingTaskCsvImport.data}
            members={[...schedule.members, ...pendingTaskCsvImport.membersToCreate]}
            membersToCreate={pendingTaskCsvImport.membersToCreate}
            onClose={() => setPendingTaskCsvImport(null)}
            onImport={applyPendingTaskCsvImport}
            project={schedule.project}
            sourceRows={pendingTaskCsvImport.draft.sourceRows}
            validation={pendingTaskCsvImport.validation}
          />
        ) : pendingTaskCsvImport ? (
          <TaskCsvImportSheet
            fileName={pendingTaskCsvImport.fileName}
            draft={pendingTaskCsvImport.draft}
            imported={pendingTaskCsvImport.data}
            members={[...schedule.members, ...pendingTaskCsvImport.membersToCreate]}
            membersToCreate={pendingTaskCsvImport.membersToCreate}
            onClose={() => setPendingTaskCsvImport(null)}
            onImport={applyPendingTaskCsvImport}
            onMappingChange={updatePendingTaskCsvMapping}
            project={schedule.project}
            validation={pendingTaskCsvImport.validation}
          />
        ) : null}
        {showMainProjectViews && activeTab === "Gantt" && showCreateSheet ? (
          <CreateTaskSheet
            members={projectMembers}
            onClose={() => setShowCreateSheet(false)}
            onCreateTask={taskActions.createTask}
            tasks={tasks}
          />
        ) : null}
        {showShortcutHelp ? <ShortcutHelpSheet onClose={() => setShowShortcutHelp(false)} /> : null}
        {showSaveReview ? (
          <SaveReviewDialog
            configReview={configChangeReview}
            onClose={() => setShowSaveReview(false)}
            onConfirm={() => saveDraft(currentDraftRef.current)}
            onSelectTask={selectTaskFromSecondaryView}
            project={schedule.project}
            review={taskChangeReview}
            scopeLabel={saveScopeLabel}
          />
        ) : null}
        {showResetConfirm ? (
          <ResetDraftDialog
            apiDetail={syncStatus.detail}
            apiTitle={syncStatus.title}
            configReview={workspaceConfigChangeReview}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            localDraftChangeSummary={localDraftChangeSummary}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={resetDraft}
            project={schedule.project}
            review={workspaceTaskChangeReview}
          />
        ) : null}
      </Suspense>
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </div>
  );
}
