import { Provider } from "jotai";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sidebar } from "../components/layout/Sidebar";
import { type ExportFormat, Topbar } from "../components/layout/Topbar";
import { ToastViewport } from "../components/ui/ToastViewport";
import { type AuthUser } from "../data/authRepository";
import { clearLocalScheduleDraft, saveLocalScheduleDraft } from "../data/localScheduleStorage";
import { type ScheduleSnapshot } from "../data/scheduleRepository";
import { useActivityLog } from "../features/activity/hooks/useActivityLog";
import { todayKey } from "../features/gantt/components/constants";
import { GanttWorkbench } from "../features/gantt/components/GanttWorkbench";
import { useGanttKeyboardShortcuts } from "../features/gantt/hooks/useGanttKeyboardShortcuts";
import { useTaskActions } from "../features/gantt/hooks/useTaskActions";
import { useTaskActualUpdater } from "../features/gantt/hooks/useTaskActualUpdater";
import { useTaskHistory } from "../features/gantt/hooks/useTaskHistory";
import { useTaskSelection } from "../features/gantt/hooks/useTaskSelection";
import type { TaskClipboard } from "../features/gantt/types/ganttState";
import { OnboardingTour } from "../features/onboarding/components/OnboardingTour";
import { getTourCompletionKey, tourScenarios } from "../features/onboarding/tourScenarios";
import { useProjectActivityActions } from "../features/projects/hooks/useProjectActivityActions";
import { useProjectAttachments } from "../features/projects/hooks/useProjectAttachments";
import { useProjectConfigurationActions } from "../features/projects/hooks/useProjectConfigurationActions";
import { useProjectImportActions } from "../features/projects/hooks/useProjectImportActions";
import { useProjectImportCommitActions } from "../features/projects/hooks/useProjectImportCommitActions";
import { createProjectExportFile } from "../features/projects/lib/projectExportService";
import { useMasterDataActions } from "../features/settings/hooks/useMasterDataActions";
import { useToastQueue } from "../hooks/useToastQueue";
import {
  buildTaskChangeReview,
  buildWorkspaceConfigChangeReview,
  buildWorkspaceTaskChangeReview,
} from "../lib/changeReview";
import { isProjectArchived } from "../lib/projects";
import { getProgressStats } from "../lib/schedule";
import { type ScheduleHealthIssue, buildScheduleHealthReport } from "../lib/scheduleHealth";
import { mergeScheduleIntoWorkspace } from "../lib/scheduleWorkspace";
import { type TaskPasteMode, normalizeSummaryTasks } from "../lib/taskOperations";
import type { TaskInspectorFocusTarget } from "../types/schedule";
import {
  createConfigChangeReviewFromRows,
  createDraftSignature,
  createLocalDraftChangeSummary,
  createPersistableDraft,
  getHealthIssueFocusTarget,
  initialFilters,
  mergeProjectScopedSavedDraft,
} from "./appState";
import type { ApiSyncState, AppInitialState } from "./appTypes";
import { useWorkbenchRouting } from "./routing/useWorkbenchRouting";
import { buildTopbarSyncQueueItems, createTopbarSyncStatus } from "./syncPresentation";
import { useDailyReportReminders } from "./useDailyReportReminders";
import { useScheduleSync } from "./useScheduleSync";
import { useTeamScheduleLoading } from "./useTeamScheduleLoading";
import { useWorkbenchGanttControls } from "./useWorkbenchGanttControls";
import { useWorkbenchGanttModel } from "./useWorkbenchGanttModel";
import { useWorkbenchNotifications } from "./useWorkbenchNotifications";
import { useWorkbenchOverlays } from "./useWorkbenchOverlays";
import { useWorkbenchProjectContext } from "./useWorkbenchProjectContext";
import { useWorkbenchProjectNavigation } from "./useWorkbenchProjectNavigation";
import { useWorkbenchResources } from "./useWorkbenchResources";
import { useWorkbenchScreenNavigation } from "./useWorkbenchScreenNavigation";
import { downloadTextFile, focusTaskTitleEditor, ViewLoading } from "./workbenchHelpers";
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

/** 画面状態をワークベンチ単位のJotaiストアへ閉じ込めます。 */
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
  const {
    activeTab,
    navigateToHelp,
    navigateToManagementSettings,
    navigateToProjectSettings,
    navigateToProjectView,
    routeProjectId,
    setActiveTab,
    showHelpPage,
    showMasterSettings,
    showProjectSettings,
  } = useWorkbenchRouting(activeProjectId);
  const [workspace, setWorkspace] = useState(initialAppState.workspace);
  const dailyReportReminders = useDailyReportReminders(activeTab);
  const {
    pendingProjectImport,
    pendingTaskCsvImport,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowProjectCreateSheet,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    showCreateSheet,
    showProjectCreateSheet,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
  } = useWorkbenchOverlays();
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
  const initialRouteNoticeShownRef = useRef(false);
  const initialTourCheckedRef = useRef(false);
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
  const { activityLogs, appendActivityEntry, createActivityEntry, recordActivity } = useActivityLog(
    {
      actor: currentUser.name,
      activeProjectId: schedule.project.id,
      initialLogs: initialAppState.activityLogs,
    },
  );
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

  const { collapsedIds, ganttColumns, projectMembers, resourceWeeks, timeline, visibleRows } =
    useWorkbenchGanttModel({
      activeProjectId,
      activeTeam,
      calendarAware,
      collapsedIdsByProject,
      filters,
      schedule,
      tasks,
      timeUnit,
    });
  const { setCollapsedIds, setCollapsedIdsForProject, toggleCollapsed, updateStatusFilter } =
    useWorkbenchGanttControls({ activeProjectId, setCollapsedIdsByProject, setFilters });
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
  const {
    changeTab,
    closeTransientUi,
    closeTour,
    helpDocumentId,
    openHelpPage,
    openMasterSettings,
    openProjectCreateSheet,
    openProjectSettings,
    startTour,
  } = useWorkbenchScreenNavigation({
    activeTab,
    clearTaskSelection,
    closeTaskInspector,
    currentUserEmail: currentUser.email,
    navigateToHelp,
    navigateToManagementSettings,
    navigateToProjectSettings,
    setActiveTab,
    setActiveTourId,
    setFilterOpen,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowProjectCreateSheet,
    setShowShortcutHelp,
    showMasterSettings,
    showProjectSettings,
  });
  const {
    activateProject,
    archiveProject,
    changeProject,
    changeTeam,
    createProject,
    favoriteProjectIds,
    loadingProjectId,
    nextProjectIndex,
    removeFavoriteProject,
    restoreProject,
    toggleFavoriteProject,
  } = useWorkbenchProjectNavigation({
    activeProjectId,
    activeTab,
    activeTeam,
    activeTeamId,
    addToast,
    calendarAware,
    clearTaskSelection,
    closeTransientUi,
    initialFavoriteProjectIds: initialAppState.favoriteProjectIds,
    initializeProject,
    navigateToProjectView,
    persistNavigationState,
    projectSummaries,
    recordActivity,
    replaceProject,
    schedule,
    selectOnlyTask,
    setActiveProjectId,
    setActiveTab,
    setActiveTeamId,
    setCollapsedIdsForProject,
    setFilterOpen,
    setWorkspace,
    workspace,
  });
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
  const { addAttachment: addProjectAttachment, deleteAttachment: deleteProjectAttachment } =
    useProjectAttachments({ projectId: schedule.project.id, setWorkspace });
  const navigateToGantt = useCallback(
    (projectId: string) => navigateToProjectView(projectId, "Gantt", { replace: true }),
    [navigateToProjectView],
  );
  const {
    updateCalendar,
    updateProjectLifecycleStatus,
    updateProjectSettings,
    updateProjectStaffing,
  } = useProjectConfigurationActions({
    activeProjectId: schedule.project.id,
    navigateToGantt,
    onActivity: recordActivity,
    onToast: addToast,
    projectSummaries,
    setActiveTeamId,
    setWorkspace,
    workspace,
  });
  const closeImportCompetingOverlays = useCallback(() => {
    setShowCreateSheet(false);
    setShowProjectCreateSheet(false);
    setShowShortcutHelp(false);
  }, [setShowCreateSheet, setShowProjectCreateSheet, setShowShortcutHelp]);
  const { importBrabioXlsx, importProject, importTaskCsv, updatePendingTaskCsvMapping } =
    useProjectImportActions({
      closeCompetingOverlays: closeImportCompetingOverlays,
      onToast: addToast,
      schedule,
      setPendingProjectImport,
      setPendingTaskCsvImport,
    });
  const { applyPendingProjectImport, applyPendingTaskImport: applyPendingTaskCsvImport } =
    useProjectImportCommitActions({
      activeTeam,
      activeTeamId,
      clearTaskSelection,
      commitTasks,
      navigateToProjectView,
      onToast: addToast,
      pendingProjectImport,
      pendingTaskCsvImport,
      project: schedule.project,
      recordActivity,
      removeFavoriteProject,
      replaceProject,
      selectOnlyTask,
      setActiveProjectId,
      setActiveTab,
      setActiveTeamId,
      setCollapsedIds,
      setCollapsedIdsForProject,
      setPendingProjectImport,
      setPendingTaskCsvImport,
      setWorkspace,
      workspace,
    });
  const {
    createMember,
    createTeam,
    toggleTeamMember,
    updateMember,
    updateMemberLifecycle,
    updateTeam,
    updateTeamCalendarMaster,
  } = useMasterDataActions({
    activeTeam,
    onActivity: recordActivity,
    onToast: addToast,
    projectSummaries,
    scheduleMembers: schedule.members,
    setWorkspace,
    workspace,
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
    if (
      !routeProjectId ||
      routeProjectId === activeProjectId ||
      routeProjectId === loadingProjectId
    ) {
      return;
    }
    const nextProject =
      workspace.schedules.find((snapshot) => snapshot.project.id === routeProjectId)?.project ??
      projectSummaries.find((summary) => summary.project.id === routeProjectId)?.project;
    if (!nextProject) {
      addToast({
        detail: routeProjectId,
        title: "共有リンクのプロジェクトが見つかりません",
        tone: "warning",
      });
      void navigateToProjectView(activeProjectId, activeTab, { replace: true });
      return;
    }
    if (isProjectArchived(nextProject)) {
      addToast({
        detail: nextProject.workspace,
        title: "アーカイブ済みプロジェクトです",
        tone: "warning",
      });
      void navigateToProjectView(activeProjectId, activeTab, { replace: true });
      return;
    }
    activateProject(nextProject.id, { updateRoute: false });
  }, [
    activateProject,
    activeProjectId,
    activeTab,
    loadingProjectId,
    projectSummaries,
    routeProjectId,
    workspace.schedules,
  ]);

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

  /** タスクを選択し、タイトル編集へフォーカスします。 */
  function selectAndFocusTaskTitle(taskId: string) {
    selectOnlyTask(taskId);
    void setActiveTab("Gantt");
    setTaskTitleEditRequest((current) => ({ requestId: current.requestId + 1, taskId }));
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
    void navigateToProjectView(projectId ?? activeProjectId, "Gantt");
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

  /** プロジェクトデータを指定形式で出力します。 */
  function exportProject(format: ExportFormat) {
    const file = createProjectExportFile(format, schedule, tasks, activeTeam);
    downloadTextFile(file.fileName, file.content, file.mimeType);
    addToast({ detail: file.fileName, title: file.toastTitle });
    recordActivity({
      category: "import",
      detail: file.fileName,
      title: file.activityTitle,
      tone: "info",
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
    const nextActivityLogs = appendActivityEntry(entry);
    const draftWithActivity = {
      ...draft,
      activityLogs: nextActivityLogs,
    };
    const nextDraft = projectScopedSave
      ? mergeProjectScopedSavedDraft(savedDraftRef.current, draftWithActivity, schedule.project.id)
      : draftWithActivity;
    saveLocalScheduleDraft(nextDraft);
    setShowSaveReview(false);
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
              availableTours={availableTourIds.map((tourId) => tourScenarios[tourId])}
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
                  void navigateToProjectView(projectId, "Issues");
                }
              }}
              onOpenProject={(projectId) => {
                if (changeProject(projectId)) {
                  void navigateToProjectView(projectId, "Gantt");
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
                  void navigateToProjectView(projectId, "Gantt");
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
