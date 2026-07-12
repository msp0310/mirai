import { Provider } from "jotai";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sidebar } from "../components/layout/Sidebar";
import { type ExportFormat, Topbar } from "../components/layout/Topbar";
import { type ViewTab } from "../components/layout/ViewTabs";
import { ToastViewport } from "../components/ui/ToastViewport";
import { apiScheduleRepository } from "../data/apiScheduleRepository";
import { type AuthUser } from "../data/authRepository";
import { listDailyReportReminders } from "../data/dailyReportRepository";
import { clearLocalScheduleDraft, saveLocalScheduleDraft } from "../data/localScheduleStorage";
import { createProjectFromTemplate } from "../data/projectTemplates";
import {
  ProjectImportError,
  type TaskCsvImportDraft,
  type TaskCsvImportMapping,
  createBrabioXlsxImportDraft,
  createTaskCsvImportDraft,
  parseProjectImportJson,
  parseTaskCsvImportFromDraft,
  validateProjectImportData,
  validateTaskCsvImportData,
} from "../data/scheduleImportExport";
import { type ScheduleSnapshot } from "../data/scheduleRepository";
import { todayKey } from "../features/gantt/components/constants";
import { GanttWorkbench } from "../features/gantt/components/GanttWorkbench";
import type { TaskCsvImportOptions } from "../features/gantt/components/TaskCsvImportSheet";
import { useGanttKeyboardShortcuts } from "../features/gantt/hooks/useGanttKeyboardShortcuts";
import { useTaskActions } from "../features/gantt/hooks/useTaskActions";
import { useTaskActualUpdater } from "../features/gantt/hooks/useTaskActualUpdater";
import { useTaskHistory } from "../features/gantt/hooks/useTaskHistory";
import { useTaskSelection } from "../features/gantt/hooks/useTaskSelection";
import { OnboardingTour } from "../features/onboarding/components/OnboardingTour";
import {
  type TourId,
  getTourCompletionKey,
  tourScenarios,
} from "../features/onboarding/tourScenarios";
import type { CreateProjectTemplateInput } from "../features/projects/components/ProjectCreateSheet";
import type { ProjectImportMode } from "../features/projects/components/ProjectImportSheet";
import { useProjectActivityActions } from "../features/projects/hooks/useProjectActivityActions";
import type { HelpDocumentId } from "../help/helpDocuments";
import { useToastQueue } from "../hooks/useToastQueue";
import {
  buildTaskChangeReview,
  buildWorkspaceConfigChangeReview,
  buildWorkspaceTaskChangeReview,
} from "../lib/changeReview";
import { getActiveMembers, isMemberActive } from "../lib/members";
import { getProjectAssignedMembers, projectLifecycleLabels } from "../lib/projects";
import {
  buildGanttHeaderColumns,
  buildTimeline,
  buildWeekColumns,
  filterTaskRows,
  flattenTasks,
  getProgressStats,
} from "../lib/schedule";
import { type ScheduleHealthIssue, buildScheduleHealthReport } from "../lib/scheduleHealth";
import { type TaskPasteMode, normalizeSummaryTasks } from "../lib/taskOperations";
import type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityTone,
  Attachment,
  CalendarDefinition,
  DailyReportReminder,
  Member,
  Project,
  ProjectAssignment,
  ProjectLifecycleStatus,
  StaffingDemand,
  TaskInspectorFocusTarget,
  TaskStatus,
  Team,
} from "../types/schedule";
import {
  createConfigChangeReviewFromRows,
  createDraftSignature,
  createLocalDraftChangeSummary,
  createPersistableDraft,
  getGanttTimelineRange,
  getHealthIssueFocusTarget,
  getOperationalProjectStatus,
  getProjectIdFromHash,
  getTaskRange,
  initialFilters,
  isProjectArchived,
  mergeProjectScopedSavedDraft,
  writeProjectHash,
} from "./appState";
import type { ApiSyncState, AppInitialState, TaskClipboard } from "./appTypes";
import { mergeScheduleIntoWorkspace } from "./projectLoading";
import { buildTopbarSyncQueueItems, createTopbarSyncStatus } from "./syncPresentation";
import { useScheduleSync } from "./useScheduleSync";
import { useTeamScheduleLoading } from "./useTeamScheduleLoading";
import { useWorkbenchNotifications } from "./useWorkbenchNotifications";
import { type PendingTaskCsvImport, useWorkbenchOverlays } from "./useWorkbenchOverlays";
import { useWorkbenchProjectContext } from "./useWorkbenchProjectContext";
import { useWorkbenchResources } from "./useWorkbenchResources";
import {
  activityActor,
  addMissingMembers,
  appendActivityLogEntry,
  createProjectSummaryFromSnapshot,
  createUniqueImportedId,
  downloadTextFile,
  escapeCsv,
  focusTaskTitleEditor,
  getTaskImportSourceLabel,
  isOptionalAssigneeWarning,
  uniqueStrings,
  ViewLoading,
} from "./workbenchHelpers";
import {
  ActivityPanel,
  AnalysisPanel,
  BrabioTaskImportSheet,
  CalendarPanel,
  CreateTaskSheet,
  DailyReportPage,
  HelpPage,
  MasterSettingsPage,
  MilestonePanel,
  PersonalAnalyticsPage,
  ProjectCreateSheet,
  ProjectImportSheet,
  ProjectIssuePanel,
  ProjectPortfolioPanel,
  ProjectSettingsPage,
  ResetDraftDialog,
  ResourcePanel,
  SaveReviewDialog,
  ShortcutHelpSheet,
  SummaryStrip,
  TaskCsvImportSheet,
  TaskInspector,
  WeeklyReportPanel,
  WorkLogPanel,
  WorkloadOverviewPage,
} from "./workbenchLazyViews";
import { createWorkbenchViewStore, useWorkbenchViewState } from "./workbenchViewState";

type AppWorkbenchProps = {
  currentUser: AuthUser;
  initialAppState: AppInitialState;
  onLogout: () => Promise<void>;
  onReloadWorkspace: () => void;
};

type CollapsedIdUpdate = Set<string> | ((current: Set<string>) => Set<string>);

type ActivityInput = {
  category: ActivityCategory;
  detail: string;
  projectId?: string;
  taskId?: string;
  title: string;
  tone?: ActivityTone;
};

/** 画面状態をワークベンチ単位のJotai Storeへ閉じ込めます。 */
export function AppWorkbench(props: AppWorkbenchProps) {
  const [viewStore] = useState(() => createWorkbenchViewStore(props.initialAppState));
  return (
    <Provider store={viewStore}>
      <AppWorkbenchContent {...props} />
    </Provider>
  );
}

/** プロジェクト状態・タスク操作・各ビューを束ねる認証後のアプリケーションシェルです。 */
function AppWorkbenchContent({
  currentUser,
  initialAppState,
  onLogout,
  onReloadWorkspace,
}: AppWorkbenchProps) {
  const {
    activeProjectId,
    activeTab,
    activeTeamId,
    activeTourId,
    calendarAware,
    collapsedIdsByProject,
    columnVisibility,
    filterOpen,
    filters,
    ganttDisplayMode,
    resourceDisplaySettings,
    resourceScope,
    scale,
    setActiveProjectId,
    setActiveTab,
    setActiveTeamId,
    setActiveTourId,
    setCalendarAware,
    setCollapsedIdsByProject,
    setColumnVisibility,
    setFilterOpen,
    setFilters,
    setGanttDisplayMode,
    setResourceDisplaySettings,
    setResourceScope,
    setScale,
    setTaskStartFocusSignal,
    setTaskTitleEditRequest,
    setTimeUnit,
    setTodaySignal,
    taskStartFocusSignal,
    taskTitleEditRequest,
    timeUnit,
    todaySignal,
  } = useWorkbenchViewState();
  const [workspace, setWorkspace] = useState(initialAppState.workspace);
  const [helpDocumentId, setHelpDocumentId] = useState<HelpDocumentId>(() =>
    getContextHelpDocumentId(initialAppState.activeTab, false, false),
  );
  const [dailyReportReminders, setDailyReportReminders] = useState<DailyReportReminder[]>([]);
  useEffect(() => {
    let active = true;
    listDailyReportReminders()
      .then((items) => {
        if (active) {
          setDailyReportReminders(items);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeTab]);
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
  const [activityLogs, setActivityLogs] = useState(initialAppState.activityLogs);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<Set<string>>(
    () => new Set(initialAppState.favoriteProjectIds),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialAppState.lastSavedAt);
  const [savedSignature, setSavedSignature] = useState(initialAppState.savedSignature);
  const [savedWorkspace, setSavedWorkspace] = useState(initialAppState.savedWorkspace);
  const [apiSyncState, setApiSyncState] = useState<ApiSyncState>({
    error: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    queuedChangeCount: 0,
    status: "idle",
  });
  const [saveRequestId, setSaveRequestId] = useState(0);
  const [taskClipboard, setTaskClipboard] = useState<TaskClipboard | null>(null);
  const [taskPasteMode] = useState<TaskPasteMode>("sibling");
  const taskClipboardRef = useRef<TaskClipboard | null>(null);
  const activityIdRef = useRef(0);
  const initialRouteNoticeShownRef = useRef(false);
  const initialTourCheckedRef = useRef(false);
  const projectLoadRequestIdRef = useRef(0);
  const saveOperationIdRef = useRef(0);
  const { addToast, dismissToast, toasts } = useToastQueue();
  const handleTeamScheduleLoadError = useCallback(
    (message: string) =>
      addToast({
        detail: message,
        title: "チーム案件を読み込めませんでした",
        tone: "warning",
      }),
    [addToast],
  );
  const {
    activeProjectCount,
    activeTeam,
    activeTeamProjects,
    availableTourIds,
    canEditPlan,
    canEnterActual,
    managementTeam,
    projectSummaries,
    schedule,
    workspaceProjects,
  } = useWorkbenchProjectContext({
    activeProjectId,
    activeTeamId,
    currentUserRole: currentUser.role,
    workspace,
  });
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

  const ganttTimelineRange = useMemo(
    () => getGanttTimelineRange(tasks, schedule.project),
    [schedule.project, tasks],
  );
  const timeline = useMemo(
    () =>
      buildTimeline(
        ganttTimelineRange.start,
        ganttTimelineRange.end,
        schedule.calendar,
        calendarAware,
        timeUnit,
      ),
    [calendarAware, ganttTimelineRange.end, ganttTimelineRange.start, schedule.calendar, timeUnit],
  );
  const dayTimeline = useMemo(
    () =>
      buildTimeline(
        ganttTimelineRange.start,
        ganttTimelineRange.end,
        schedule.calendar,
        calendarAware,
        "day",
      ),
    [calendarAware, ganttTimelineRange.end, ganttTimelineRange.start, schedule.calendar],
  );
  const ganttColumns = useMemo(
    () => buildGanttHeaderColumns(timeline, timeUnit),
    [timeline, timeUnit],
  );
  const resourceWeeks = useMemo(() => buildWeekColumns(dayTimeline), [dayTimeline]);
  const collapsedIds = useMemo(
    () => new Set(collapsedIdsByProject[activeProjectId]),
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
  const guardedCommitTasks = canEditPlan
    ? commitTasks
    : () => addToast({ title: "計画の編集権限がありません", tone: "warning" });
  const updateTaskActual = useTaskActualUpdater({
    onReplaceProject: replaceProject,
    onToast: addToast,
    projectId: schedule.project.id,
    projectVersion: schedule.project.version,
    setWorkspace,
    tasks,
  });
  const taskActions = useTaskActions({
    canComment: schedule.access?.canComment ?? false,
    canEditPlan,
    canEnterActual,
    calendar: schedule.calendar,
    calendarAware,
    clearTaskSelection,
    commitTasks: guardedCommitTasks,
    onActivity: recordActivity,
    onUpdateComment: (taskId, patch) => {
      commitTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      );
    },
    onUpdateActual: updateTaskActual,
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
  const { activeTeamReviewSchedules, displayedResourceRows, displayedResourceWeeks, resourceRows } =
    useWorkbenchResources({
      activeTeam,
      activeTeamId,
      calendarAware,
      currentReviewSchedules,
      projectMembers,
      resourceScope,
      resourceWeeks,
      schedule,
      tasks,
    });
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
  const topbarNotifications = useWorkbenchNotifications({
    dailyReportReminders,
    healthReport,
    resourceRows,
    tasks,
  });
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
  const isProjectSaveScope =
    !showMasterSettings &&
    !showHelpPage &&
    activeTab !== "Projects" &&
    activeTab !== "Workload" &&
    activeTab !== "DailyReports" &&
    activeTab !== "PersonalAnalytics";
  const projectSaveScopeLabel =
    activeTab === "Issues" || activeTab === "WorkLogs" ? "この案件" : "このガント";
  const saveScopeLabel = isProjectSaveScope
    ? projectSaveScopeLabel
    : showMasterSettings
      ? "管理設定"
      : activeTab === "Workload"
        ? "要員計画"
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
  const handleTeamSchedulesLoaded = useCallback((loadedSchedules: ScheduleSnapshot[]) => {
    const nextSavedWorkspace = loadedSchedules.reduce(
      mergeScheduleIntoWorkspace,
      savedDraftRef.current.workspace,
    );
    savedDraftRef.current = { ...savedDraftRef.current, workspace: nextSavedWorkspace };
    setSavedWorkspace(nextSavedWorkspace);
    setSavedSignature(createDraftSignature(savedDraftRef.current));
  }, []);
  const teamResourcesLoading = useTeamScheduleLoading({
    activeTab,
    activeTeamId,
    onError: handleTeamScheduleLoadError,
    onLoaded: handleTeamSchedulesLoaded,
    projectSummaries,
    resourceScope,
    setWorkspace,
    workspace,
  });
  const localDraftChangeSummary = useMemo(
    () => createLocalDraftChangeSummary(currentDraft, savedDraftRef.current),
    [currentDraft, savedSignature],
  );
  const syncStatus = useMemo(
    () =>
      createTopbarSyncStatus({
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
  const { retryApiSync, scheduleApiSync } = useScheduleSync({
    addToast,
    apiSyncState,
    hasUnsavedChangesRef,
    requestSaveDraft,
    saveOperationIdRef,
    savedDraftRef,
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
    if (initialRouteNoticeShownRef.current) {
      return;
    }
    initialRouteNoticeShownRef.current = true;
    if (!initialAppState.routeProjectId) {
      return;
    }

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
    if (!hasUnsavedChanges) {
      return;
    }
    const savedDraft = savedDraftRef.current;
    const currentWithSavedLocalState = {
      ...currentDraft,
      activeProjectId: savedDraft.activeProjectId,
      activeTab: savedDraft.activeTab,
      activeTeamId: savedDraft.activeTeamId,
      activityLogs: savedDraft.activityLogs,
      calendarAware: savedDraft.calendarAware,
      collapsedIdsByProject: savedDraft.collapsedIdsByProject,
      columnVisibility: savedDraft.columnVisibility,
      favoriteProjectIds: savedDraft.favoriteProjectIds,
      filterOpen: savedDraft.filterOpen,
      filters: savedDraft.filters,
      resourceDisplaySettings: savedDraft.resourceDisplaySettings,
      resourceScope: savedDraft.resourceScope,
      scale: savedDraft.scale,
      timeUnit: savedDraft.timeUnit,
    };
    if (createDraftSignature(currentWithSavedLocalState) === createDraftSignature(savedDraft)) {
      persistLocalState(currentDraft);
    }
  }, [currentDraft, hasUnsavedChanges]);

  useEffect(() => {
    if (showMasterSettings || (activeTab === "Projects" && !showProjectSettings)) {
      return;
    }
    writeProjectHash(activeProjectId, "replace");
  }, [activeProjectId, activeTab, showMasterSettings, showProjectSettings]);

  useEffect(() => {
    function handleProjectRouteChange() {
      const projectId = getProjectIdFromHash();
      if (!projectId || projectId === activeProjectId) {
        return;
      }
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

  /** API保存対象ではない表示状態を端末へ保存し、未保存判定から除外します。 */
  function persistLocalState(draft: typeof currentDraft) {
    saveLocalScheduleDraft(draft);
    savedDraftRef.current = {
      ...savedDraftRef.current,
      activeProjectId: draft.activeProjectId,
      activeTab: draft.activeTab,
      activeTeamId: draft.activeTeamId,
      activityLogs: draft.activityLogs,
      calendarAware: draft.calendarAware,
      collapsedIdsByProject: draft.collapsedIdsByProject,
      columnVisibility: draft.columnVisibility,
      favoriteProjectIds: draft.favoriteProjectIds,
      filterOpen: draft.filterOpen,
      filters: draft.filters,
      resourceDisplaySettings: draft.resourceDisplaySettings,
      resourceScope: draft.resourceScope,
      scale: draft.scale,
      timeUnit: draft.timeUnit,
    };
    setSavedSignature(createDraftSignature(savedDraftRef.current));
  }

  /** 案件・チーム選択を表示設定として保存します。 */
  function persistNavigationState(projectId: string, teamId: string | null) {
    const nextSavedDraft = {
      ...savedDraftRef.current,
      activeProjectId: projectId,
      activeTeamId: teamId ?? "",
    };
    persistLocalState(nextSavedDraft);
  }

  /** 添付メタデータだけを案件単位で更新します。スケジュール保存とは分離します。 */
  function updateProjectAttachments(updater: (current: Attachment[]) => Attachment[]) {
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === schedule.project.id
          ? { ...snapshot, attachments: updater(snapshot.attachments ?? []) }
          : snapshot,
      ),
    }));
  }

  function addProjectAttachment(attachment: Attachment) {
    updateProjectAttachments((current) => [
      attachment,
      ...current.filter((item) => item.id !== attachment.id),
    ]);
  }

  function deleteProjectAttachment(attachmentId: string) {
    updateProjectAttachments((current) => current.filter((item) => item.id !== attachmentId));
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

  /** タスクを選択し、タイトル編集へフォーカスします。 */
  function selectAndFocusTaskTitle(taskId: string) {
    selectOnlyTask(taskId);
    setActiveTab("Gantt");
    setTaskTitleEditRequest((current) => ({ requestId: current.requestId + 1, taskId }));
  }

  /** 現在案件の折りたたみ状態を更新します。 */
  function setCollapsedIds(update: CollapsedIdUpdate) {
    setCollapsedIdsForProject(activeProjectId, update);
  }

  /** 指定案件の折りたたみ状態を更新します。 */
  function setCollapsedIdsForProject(projectId: string, update: CollapsedIdUpdate) {
    setCollapsedIdsByProject((current) => {
      const currentSet = new Set(current[projectId]);
      const nextSet = typeof update === "function" ? update(currentSet) : new Set(update);
      const nextIds = [...nextSet].toSorted();
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
    closeTaskInspector();
    clearTaskSelection();
    setFilterOpen(false);
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
    setHelpDocumentId(getContextHelpDocumentId(activeTab, showMasterSettings, showProjectSettings));
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

  /** 指定した操作ツアーに必要な画面へ移動してから案内を開始します。 */
  function startTour(tourId: TourId) {
    closeTaskInspector();
    if (tourId === "admin") {
      openMasterSettings();
    } else if (tourId === "basic") {
      changeTab("Projects");
    } else {
      changeTab("Gantt");
    }
    setActiveTourId(tourId);
  }

  /** ツアー終了状態をユーザー単位で保存し、初回自動表示を繰り返さないようにします。 */
  function closeTour(tourId: TourId) {
    try {
      window.localStorage.setItem(getTourCompletionKey(currentUser.email, tourId), "completed");
    } catch {
      // ストレージが利用できない環境でも、現在のツアーは終了できます。
    }
    setActiveTourId(null);
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
    if (!taskId) {
      return;
    }
    if (projectId && projectId !== schedule.project.id) {
      const activated = activateProject(projectId);
      if (!activated) {
        return;
      }
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
    setActiveTeamId(project.teamId ?? "");
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

  /** 要員計画を案件へ反映し、参画メンバーを案件メンバーにも追加します。 */
  function updateProjectStaffing(
    projectId: string,
    assignments: ProjectAssignment[],
    staffingDemands: StaffingDemand[],
  ) {
    setWorkspace((current) => {
      const memberById = new Map(
        current.schedules
          .flatMap((snapshot) => snapshot.members)
          .map((member) => [member.id, member]),
      );
      const assignmentMemberIds = assignments.map((assignment) => assignment.memberId);
      const updateProject = (project: Project) => ({
        ...project,
        assignments,
        memberIds: [...new Set([...(project.memberIds ?? []), ...assignmentMemberIds])],
        staffingDemands,
      });
      return {
        ...current,
        projectSummaries: (current.projectSummaries ?? []).map((summary) =>
          summary.project.id === projectId
            ? { ...summary, project: updateProject(summary.project) }
            : summary,
        ),
        schedules: current.schedules.map((snapshot) => {
          if (snapshot.project.id !== projectId) {
            return snapshot;
          }
          const existingIds = new Set(snapshot.members.map((member) => member.id));
          return {
            ...snapshot,
            members: [
              ...snapshot.members,
              ...assignmentMemberIds
                .filter((memberId) => !existingIds.has(memberId))
                .map((memberId) => memberById.get(memberId))
                .filter((member): member is Member => Boolean(member)),
            ],
            project: updateProject(snapshot.project),
          };
        }),
      };
    });
    addToast({ title: "要員計画を更新しました", detail: "保存するとAPIへ反映されます。" });
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
    if (!targetProject) {
      return;
    }
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
    if (!targetSchedule) {
      return;
    }
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
      if (!current.has(projectId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
    setActiveTeamId(fallbackSchedule.project.teamId ?? "");
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
    if (!targetSchedule) {
      return;
    }
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) => {
        if (snapshot.project.id !== projectId) {
          return snapshot;
        }
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
    setActiveTeamId(targetSchedule.project.teamId ?? "");
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
  async function updateTeam(team: Team) {
    team = {
      ...team,
      memberships: team.memberIds.map(
        (memberId) =>
          team.memberships?.find((item) => item.memberId === memberId) ?? {
            memberId,
            role: "member",
          },
      ),
    };
    try {
      team = await apiScheduleRepository.saveTeam(team);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "保存できませんでした。",
        title: "チーム設定の保存に失敗しました",
        tone: "warning",
      });
      return;
    }
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
  async function createTeam(team: Team) {
    try {
      team = await apiScheduleRepository.saveTeam(team);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "追加できませんでした。",
        title: "チームの追加に失敗しました",
        tone: "warning",
      });
      return;
    }
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
  async function updateMember(member: Member) {
    try {
      member = await apiScheduleRepository.saveMember(member);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "保存できませんでした。",
        title: "メンバーの保存に失敗しました",
        tone: "warning",
      });
      return;
    }
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
  async function createMember(member: Member, teamId: string | null) {
    try {
      member = await apiScheduleRepository.saveMember(member);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "追加できませんでした。",
        title: "メンバーの追加に失敗しました",
        tone: "warning",
      });
      return;
    }
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
    if (teamId) {
      const targetTeam = workspace.teams.find((item) => item.id === teamId);
      if (targetTeam) {
        await updateTeam({
          ...targetTeam,
          memberIds: [...new Set([...targetTeam.memberIds, member.id])],
        });
      }
    }
  }

  /** チームとメンバーの所属を切り替えます。 */
  async function toggleTeamMember(teamId: string, memberId: string, enabled: boolean) {
    const target = workspace.teams.find((team) => team.id === teamId);
    if (!target) {
      return;
    }
    const savedTeam = {
      ...target,
      memberIds: enabled
        ? [...new Set([...target.memberIds, memberId])]
        : target.memberIds.filter((id) => id !== memberId),
    };
    try {
      await apiScheduleRepository.saveTeam(savedTeam);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "保存できませんでした。",
        title: "チーム所属の更新に失敗しました",
        tone: "warning",
      });
      return;
    }
    setWorkspace((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) {
          return team;
        }
        return {
          ...team,
          memberIds: enabled
            ? [...new Set([...team.memberIds, memberId])]
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
  async function updateTeamCalendarMaster(calendar: CalendarDefinition) {
    if (!activeTeam) {
      addToast({ title: "未所属案件にはチーム標準カレンダーがありません", tone: "warning" });
      return;
    }
    const teamId = activeTeam.id;
    try {
      calendar = await apiScheduleRepository.saveTeamCalendar(teamId, calendar);
    } catch (error) {
      addToast({
        detail: error instanceof Error ? error.message : "保存できませんでした。",
        title: "標準カレンダーの保存に失敗しました",
        tone: "warning",
      });
      return;
    }
    const targetProjectCount = projectSummaries.filter(
      (summary) => summary.project.teamId === teamId,
    ).length;
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.teamId === teamId
          ? {
              ...snapshot,
              calendar,
              project: { ...snapshot.project, version: (snapshot.project.version ?? 0) + 1 },
            }
          : snapshot,
      ),
      projectSummaries: (current.projectSummaries ?? []).map((summary) =>
        summary.project.teamId === teamId
          ? {
              ...summary,
              project: { ...summary.project, version: (summary.project.version ?? 0) + 1 },
            }
          : summary,
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
    if (!nextProject) {
      return false;
    }
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
      if (projectLoadRequestIdRef.current !== requestId) {
        return;
      }
      setWorkspace((current) => mergeScheduleIntoWorkspace(current, loadedSchedule));
      initializeProject(projectId, loadedSchedule.tasks);
      setActiveTeamId(loadedSchedule.project.teamId ?? "");
      setActiveProjectId(loadedSchedule.project.id);
      persistNavigationState(loadedSchedule.project.id, loadedSchedule.project.teamId);
      clearTaskSelection();
      setPendingTaskCsvImport(null);
      setPendingProjectImport(null);
      setShowCreateSheet(false);
      setShowProjectCreateSheet(false);
      setShowShortcutHelp(false);
      setFilterOpen(false);
      if (options.updateHash !== false) {
        writeProjectHash(loadedSchedule.project.id, options.historyMode ?? "push");
      }
      setLoadingProjectId(null);
    };

    if (!nextSchedule) {
      if (loadingProjectId === projectId) {
        return true;
      }
      setLoadingProjectId(projectId);
      apiScheduleRepository
        .getProjectSchedule(projectId)
        .then(completeActivation)
        .catch((error: unknown) => {
          if (projectLoadRequestIdRef.current !== requestId) {
            return;
          }
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
  async function createProject(input: CreateProjectTemplateInput) {
    const activeTeamMemberIds = new Set(activeTeam?.memberIds);
    const templateMembers = getActiveMembers(schedule.members).filter((member) =>
      activeTeamMemberIds.has(member.id),
    );
    const nextSchedule = createProjectFromTemplate({
      calendar: schedule.calendar,
      includeCalendar: calendarAware,
      members: templateMembers.length > 0 ? templateMembers : schedule.members,
      projectIndex: nextProjectIndex,
      projectName: input.projectName,
      projectNo: input.projectNo,
      startDate: input.startDate,
      teamId: activeTeamId || null,
      templateId: input.templateId,
      workspace: input.workspace,
    });
    const createdSchedule = await apiScheduleRepository
      .createProject(nextSchedule)
      .catch((error) => {
        addToast({
          detail: error instanceof Error ? error.message : "作成できませんでした。",
          title: "プロジェクトの追加に失敗しました",
          tone: "warning",
        });
        return null;
      });
    if (!createdSchedule) {
      return;
    }
    const nextSummary = createProjectSummaryFromSnapshot(createdSchedule);
    setWorkspace((current) => ({
      ...current,
      projectSummaries: [...(current.projectSummaries ?? []), nextSummary],
      schedules: [...current.schedules, createdSchedule],
    }));
    replaceProject(createdSchedule.project.id, createdSchedule.tasks);
    setActiveTeamId(createdSchedule.project.teamId ?? "");
    setActiveProjectId(createdSchedule.project.id);
    writeProjectHash(createdSchedule.project.id);
    selectOnlyTask(createdSchedule.tasks[0]?.id ?? null);
    setCollapsedIdsForProject(createdSchedule.project.id, new Set());
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
      if (existingIds.has(member.id) || nextIds.has(member.id)) {
        return;
      }
      nextIds.add(member.id);
      nextMembers.push(member);
    });
    return nextMembers;
  }

  /** 取込確認画面の列対応を更新します。 */
  function updatePendingTaskCsvMapping(mapping: TaskCsvImportMapping) {
    setPendingTaskCsvImport((current) => {
      if (!current) {
        return current;
      }
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
    if (!pendingTaskCsvImport) {
      return;
    }
    if (pendingTaskCsvImport.validation.errors.length > 0 || pendingTaskCsvImport.data === null) {
      addToast({
        detail: "インポート確認のエラーを解消してください。",
        title: `${getTaskImportSourceLabel(pendingTaskCsvImport.sourceKind)}を読み込めませんでした`,
        tone: "warning",
      });
      return;
    }

    const sourceLabel = getTaskImportSourceLabel(pendingTaskCsvImport.sourceKind);
    const { membersToCreate } = pendingTaskCsvImport;
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
                team.id === activeTeam?.id
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
    if (!pendingProjectImport) {
      return;
    }
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
    const teamExists = importedTeamId != null && existingTeamIds.has(importedTeamId);
    const nextTeamId = teamExists
      ? importedTeamId
      : imported.team
        ? createUniqueImportedId(imported.team.id, existingTeamIds)
        : (existingSchedule?.project.teamId ?? activeTeamId);
    const nextTeam =
      imported.team && !teamExists
        ? {
            ...imported.team,
            id: nextTeamId ?? imported.team.id,
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
      if (!replaceExisting || !projectIdChanged) {
        return current;
      }
      const next = new Set(current);
      next.delete(imported.project.id);
      return next;
    });
    setActiveTeamId(nextTeamId ?? "");
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

  /** 現在の変更をAPIへ送り、成功するまで未保存状態を維持します。 */
  function saveDraft(draft = currentDraftRef.current, changeReason?: string) {
    const projectScopedSave = isProjectSaveScope;
    const apiChangeCount = Math.max(
      taskChangeReviewRef.current.totalCount + configChangeReviewRef.current.totalCount,
      hasUnsavedChangesRef.current ? 1 : 0,
      1,
    );
    const entry = createActivityEntry({
      category: "sync",
      detail: projectScopedSave
        ? `${schedule.project.workspace} の変更をAPIへ送信します。`
        : `${saveScopeLabel}の変更をAPIへ送信します。`,
      title: "保存を開始しました",
      tone: "info",
    });
    const nextActivityLogs = appendActivityLogEntry(activityLogsRef.current, entry);
    const draftWithActivity = {
      ...draft,
      activityLogs: nextActivityLogs,
    };
    const nextDraft = projectScopedSave
      ? mergeProjectScopedSavedDraft(savedDraftRef.current, draftWithActivity, schedule.project.id)
      : draftWithActivity;
    saveLocalScheduleDraft(nextDraft);
    setShowSaveReview(false);
    setActivityLogSnapshot(nextActivityLogs);
    addToast({
      detail: projectScopedSave ? schedule.project.workspace : saveScopeLabel,
      title: "APIへ送信しています",
      tone: "info",
    });
    void scheduleApiSync(nextDraft, apiChangeCount, "save", changeReason);
  }

  /** 保存要求をキューに登録します。 */
  function requestSaveDraft() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSaveRequestId((value) => value + 1);
  }

  /** 現在の日程を全タスクの基準計画として保存します。 */
  function captureBaseline() {
    const targetTasks = tasks.filter((task) => task.type !== "summary");
    if (targetTasks.length === 0) {
      addToast({ title: "基準計画を設定できるタスクがありません", tone: "warning" });
      return;
    }
    if (
      !window.confirm(
        "現在の開始日・終了日を基準計画として保存します。既存の基準計画は更新されます。",
      )
    ) {
      return;
    }
    const capturedAt = new Date().toISOString();
    commitTasks((current) =>
      current.map((task) =>
        task.type === "summary"
          ? task
          : {
              ...task,
              baselineCapturedAt: capturedAt,
              baselineEnd: task.end,
              baselineStart: task.start,
            },
      ),
    );
    recordActivity({
      category: "task",
      detail: `${targetTasks.length}件の開始日・終了日を基準計画として保存しました。`,
      title: "基準計画を設定しました",
      tone: "success",
    });
    addToast({
      detail: `${targetTasks.length}件のタスクを対象にしました。保存するとAPIへ反映されます。`,
      title: "基準計画を設定しました",
      tone: "success",
    });
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
    onFocusAssigneeFilter: () => {
      const select = document.querySelector<HTMLSelectElement>('[data-command="assignee-filter"]');
      select?.focus();
    },
    onFocusSelectedTitle: () => {
      if (selectedTaskId) {
        focusTaskTitleEditor(selectedTaskId);
      }
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
    if (saveRequestId === 0) {
      return;
    }
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
    if (!hasUnsavedChanges) {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (
      initialTourCheckedRef.current ||
      activeTab !== "Projects" ||
      showHelpPage ||
      showMasterSettings ||
      showProjectSettings
    ) {
      return;
    }
    try {
      if (window.localStorage.getItem(getTourCompletionKey(currentUser.email, "basic"))) {
        initialTourCheckedRef.current = true;
        return;
      }
    } catch {
      // ストレージが利用できない場合は、このセッション内だけ初回ツアーを表示します。
    }
    const timeoutId = window.setTimeout(() => {
      initialTourCheckedRef.current = true;
      setActiveTourId("basic");
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, currentUser.email, showHelpPage, showMasterSettings, showProjectSettings]);

  const activeFilterCount =
    Object.values(filters.statuses).filter((enabled) => !enabled).length +
    (filters.assigneeId !== "all" ? 1 : 0);
  const nextProjectIndex =
    projectSummaries.filter(
      (summary) =>
        summary.project.teamId === (activeTeamId || null) && !isProjectArchived(summary.project),
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
          !showMasterSettings &&
          !showHelpPage &&
          (showProjectSettings ||
            (activeTab !== "Projects" &&
              activeTab !== "Workload" &&
              activeTab !== "DailyReports" &&
              activeTab !== "PersonalAnalytics"))
        }
        projectSettingsOpen={showProjectSettings}
        settingsOpen={showMasterSettings}
        showAdminSettings={
          currentUser.role === "admin" || (schedule.access?.canManageStaffing ?? false)
        }
        showProjectSettings={schedule.access?.canManageProject ?? true}
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
          contextMode={
            showHelpPage
              ? "help"
              : showMasterSettings
                ? "admin"
                : activeTab === "Projects"
                  ? "portfolio"
                  : activeTab === "DailyReports"
                    ? "dailyReports"
                    : activeTab === "PersonalAnalytics"
                      ? "personalAnalytics"
                      : activeTab === "Workload"
                        ? "workload"
                        : "project"
          }
          currentUser={currentUser}
          favorite={favoriteProjectIds.has(schedule.project.id)}
          favoriteProjectIds={favoriteProjectIds}
          hasUnsavedChanges={hasUnsavedChanges}
          notifications={topbarNotifications}
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
          {showMasterSettings && managementTeam ? (
            <MasterSettingsPage
              activeTeamProjectCount={activeTeamReviewSchedules.length}
              baseDate={schedule.project.rangeStart}
              calendar={schedule.calendar}
              canManageMembers={currentUser.role === "admin"}
              memberAssignmentCounts={memberAssignmentCounts}
              members={schedule.members}
              onCreateMember={createMember}
              onCreateTeam={createTeam}
              onSaveCalendar={updateTeamCalendarMaster}
              onSaveMember={updateMember}
              onSaveTeam={updateTeam}
              onToggleTeamMember={toggleTeamMember}
              onUpdateMemberLifecycle={updateMemberLifecycle}
              team={managementTeam}
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
          {showHelpPage ? (
            <HelpPage
              availableTourIds={availableTourIds}
              initialDocumentId={helpDocumentId}
              onStartTour={startTour}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Gantt" ? (
            <GanttWorkbench
              activeFilterCount={activeFilterCount}
              calendar={schedule.calendar}
              calendarAware={calendarAware}
              projectRangeEnd={schedule.project.rangeEnd}
              projectRangeStart={schedule.project.rangeStart}
              canEditPlan={canEditPlan}
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
              onClearSelection={clearTaskSelection}
              onCopyTask={taskActions.copySelectedTask}
              onCreateTask={() => setShowCreateSheet(true)}
              onDeleteTask={taskActions.deleteSelectedTasks}
              onDuplicateTask={taskActions.duplicateSelectedTask}
              onFilterOpenChange={setFilterOpen}
              onFilterReset={() => setFilters(initialFilters)}
              onIndentTasks={taskActions.indentSelectedTasks}
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
              taskTitleEditRequest={taskTitleEditRequest}
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
              onCaptureBaseline={captureBaseline}
              onOpenHealthIssue={openHealthIssue}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
              resourceRows={resourceRows}
              stats={stats}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Analysis" ? (
            <AnalysisPanel
              calendar={schedule.calendar}
              calendarAware={calendarAware}
              changeLogs={schedule.changeLogs ?? []}
              onCaptureBaseline={captureBaseline}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "WeeklyReport" ? (
            <WeeklyReportPanel
              issues={activeIssues}
              members={projectMembers}
              onOpenIssues={() => changeTab("Issues")}
              onSelectTask={selectTaskFromSecondaryView}
              project={schedule.project}
              tasks={tasks}
              todayKey={todayKey}
              workLogs={schedule.workLogs ?? []}
            />
          ) : null}
          {showMainProjectViews && activeTab === "Issues" ? (
            <ProjectIssuePanel
              attachments={schedule.attachments ?? []}
              currentUser={currentUser}
              issues={activeIssues}
              members={projectMembers}
              onCreateIssue={createProjectIssue}
              onSelectTask={(taskId) => selectTaskFromSecondaryView(taskId)}
              onUpdateIssue={updateProjectIssue}
              onAttachmentAdded={addProjectAttachment}
              onAttachmentDeleted={deleteProjectAttachment}
              project={schedule.project}
              tasks={tasks}
            />
          ) : null}
          {showMainProjectViews && activeTab === "WorkLogs" ? (
            <WorkLogPanel
              attachments={schedule.attachments ?? []}
              currentUser={currentUser}
              issues={activeIssues}
              members={projectMembers}
              onCreateWorkLog={createProjectWorkLog}
              onDeleteWorkLog={deleteProjectWorkLog}
              onSelectTask={(taskId) => selectTaskFromSecondaryView(taskId)}
              onUpdateWorkLog={updateProjectWorkLog}
              onAttachmentAdded={addProjectAttachment}
              onAttachmentDeleted={deleteProjectAttachment}
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
              onOpenProjectIssues={(projectId) => {
                if (changeProject(projectId)) {
                  setActiveTab("Issues");
                }
              }}
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
          {showMainProjectViews && activeTab === "Workload" ? (
            <WorkloadOverviewPage
              calendar={schedule.calendar}
              calendarAware={calendarAware}
              onOpenProject={(projectId) => {
                if (changeProject(projectId)) {
                  setActiveTab("Gantt");
                }
              }}
              onOpenTeam={(teamId) => changeTeam(teamId, { stayOnPortfolio: true })}
              onUpdateProjectStaffing={updateProjectStaffing}
              schedules={currentReviewSchedules}
              teams={workspace.teams}
              todayKey={todayKey}
            />
          ) : null}
          {showMainProjectViews && activeTab === "DailyReports" && managementTeam ? (
            <DailyReportPage
              currentUser={currentUser}
              schedules={currentReviewSchedules}
              team={managementTeam}
              todayKey={todayKey}
            />
          ) : null}
          {showMainProjectViews && activeTab === "PersonalAnalytics" ? (
            <PersonalAnalyticsPage
              canViewOthers={
                currentUser.role === "admin" ||
                workspace.teams.some((team) =>
                  (team.memberships ?? []).some(
                    (membership) =>
                      membership.memberId === currentUser.memberId && membership.role === "manager",
                  ),
                )
              }
              currentUser={currentUser}
              schedules={currentReviewSchedules}
              todayKey={todayKey}
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
            attachments={schedule.attachments ?? []}
            calendar={schedule.calendar}
            calendarAware={calendarAware}
            canComment={schedule.access?.canComment ?? false}
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
            onAttachmentAdded={addProjectAttachment}
            onAttachmentDeleted={deleteProjectAttachment}
            projectId={schedule.project.id}
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
            onConfirm={(changeReason) => saveDraft(currentDraftRef.current, changeReason)}
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
      {activeTourId ? (
        <OnboardingTour
          onClose={() => closeTour(activeTourId)}
          scenario={tourScenarios[activeTourId]}
        />
      ) : null}
    </div>
  );
}

const helpDocumentByView: Record<ViewTab, HelpDocumentId> = {
  Activity: "activity",
  Analysis: "analytics",
  Calendar: "calendar",
  DailyReports: "dailyReports",
  Gantt: "gantt",
  Issues: "issues",
  Milestones: "milestones",
  PersonalAnalytics: "analytics",
  Projects: "projects",
  Resource: "resource",
  Status: "status",
  WeeklyReport: "analytics",
  WorkLogs: "workLogs",
  Workload: "analytics",
};

function getContextHelpDocumentId(
  activeTab: ViewTab,
  masterSettingsOpen: boolean,
  projectSettingsOpen: boolean,
): HelpDocumentId {
  if (masterSettingsOpen) {
    return "adminSettings";
  }
  if (projectSettingsOpen) {
    return "projectSettings";
  }
  return helpDocumentByView[activeTab];
}
