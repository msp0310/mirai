import { Provider } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type ExportFormat } from "../components/layout/Topbar";
import { type AuthUser } from "../data/authRepository";
import { clearLocalScheduleDraft, saveLocalScheduleDraft } from "../data/localScheduleStorage";
import { type ScheduleSnapshot } from "../data/scheduleRepository";
import { useActivityLog } from "../features/activity/hooks/useActivityLog";
import { useGanttKeyboardShortcuts } from "../features/gantt/hooks/useGanttKeyboardShortcuts";
import { useTaskActions } from "../features/gantt/hooks/useTaskActions";
import { useTaskActualUpdater } from "../features/gantt/hooks/useTaskActualUpdater";
import { useTaskHistory } from "../features/gantt/hooks/useTaskHistory";
import { useTaskSelection } from "../features/gantt/hooks/useTaskSelection";
import type { TaskClipboard } from "../features/gantt/types/ganttState";
import { getTourCompletionKey } from "../features/onboarding/tourScenarios";
import { useProjectActivityActions } from "../features/projects/hooks/useProjectActivityActions";
import { useProjectAttachments } from "../features/projects/hooks/useProjectAttachments";
import { useProjectConfigurationActions } from "../features/projects/hooks/useProjectConfigurationActions";
import { useProjectImportActions } from "../features/projects/hooks/useProjectImportActions";
import { useProjectImportCommitActions } from "../features/projects/hooks/useProjectImportCommitActions";
import { createProjectExportFile } from "../features/projects/lib/projectExportService";
import { useMasterDataActions } from "../features/settings/hooks/useMasterDataActions";
import { useToastQueue } from "../hooks/useToastQueue";
import { isProjectArchived } from "../lib/projects";
import { getProgressStats } from "../lib/schedule";
import { type ScheduleHealthIssue, buildScheduleHealthReport } from "../lib/scheduleHealth";
import { mergeScheduleIntoWorkspace } from "../lib/scheduleWorkspace";
import { type TaskPasteMode, normalizeSummaryTasks } from "../lib/taskOperations";
import type { TaskInspectorFocusTarget } from "../types/schedule";
import {
  createDraftSignature,
  getHealthIssueFocusTarget,
  mergeProjectScopedSavedDraft,
} from "./appState";
import type { ApiSyncState, AppInitialState } from "./appTypes";
import { AppWorkbenchView } from "./components/AppWorkbenchView";
import { useWorkbenchRouting } from "./routing/useWorkbenchRouting";
import { useDailyReportReminders } from "./useDailyReportReminders";
import { useScheduleSync } from "./useScheduleSync";
import { useTeamScheduleLoading } from "./useTeamScheduleLoading";
import { useWorkbenchDraftModel } from "./useWorkbenchDraftModel";
import { useWorkbenchGanttControls } from "./useWorkbenchGanttControls";
import { useWorkbenchGanttModel } from "./useWorkbenchGanttModel";
import { useWorkbenchNotifications } from "./useWorkbenchNotifications";
import { useWorkbenchOverlays } from "./useWorkbenchOverlays";
import { useWorkbenchProjectContext } from "./useWorkbenchProjectContext";
import { useWorkbenchProjectNavigation } from "./useWorkbenchProjectNavigation";
import { useWorkbenchResources } from "./useWorkbenchResources";
import { useWorkbenchScreenNavigation } from "./useWorkbenchScreenNavigation";
import { downloadTextFile, focusTaskTitleEditor } from "./workbenchHelpers";
import { createWorkbenchViewStore, useWorkbenchViewState } from "./workbenchViewState";

type AppWorkbenchProps = {
  currentUser: AuthUser;
  initialAppState: AppInitialState;
  onLogout: () => Promise<void>;
  onReloadWorkspace: () => void;
};

export type AppWorkbenchController = ReturnType<typeof useAppWorkbenchController>;

/** 画面状態をワークベンチ単位のJotaiストアへ閉じ込めます。 */
export function AppWorkbench(props: AppWorkbenchProps) {
  const [viewStore] = useState(() => createWorkbenchViewStore(props.initialAppState));
  return (
    <Provider store={viewStore}>
      <AppWorkbenchContent {...props} />
    </Provider>
  );
}

/** Controller Hookが返すView Modelを認証後シェルへ渡します。 */
function AppWorkbenchContent(props: AppWorkbenchProps) {
  const controller = useAppWorkbenchController(props);
  return <AppWorkbenchView controller={controller} />;
}

/** プロジェクト状態・タスク操作・feature間の調停を担当します。 */
function useAppWorkbenchController({
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
  const draftInput = useMemo(
    () => ({
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
  const savedDraftRef = useRef(initialAppState.savedDraft);
  const {
    configChangeReview,
    currentDraft,
    hasUnsavedChanges,
    isProjectSaveScope,
    localDraftChangeSummary,
    saveScopeLabel,
    syncQueueItems,
    syncStatus,
    taskChangeReview,
    workspaceConfigChangeReview,
    workspaceTaskChangeReview,
  } = useWorkbenchDraftModel({
    activeTab,
    apiSyncState,
    currentReviewSchedules,
    draftInput,
    lastSavedAt,
    savedDraft: savedDraftRef.current,
    savedSignature,
    savedWorkspace,
    schedule,
    showHelpPage,
    showMasterSettings,
    tasks,
  });
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

  return {
    activeActivityEntries,
    activeFilterCount,
    activeIssues,
    activeProjectCount,
    activeTab,
    activeTeam,
    activeTeamId,
    activeTeamProjects,
    activeTeamReviewSchedules,
    activeTourId,
    activeWorkLogs,
    addProjectAttachment,
    addToast,
    applyPendingProjectImport,
    applyPendingTaskCsvImport,
    archiveProject,
    availableTourIds,
    calendarAware,
    canEditPlan,
    captureBaseline,
    changeProject,
    changeTab,
    changeTeam,
    clearTaskSelection,
    closeTaskInspector,
    closeTour,
    collapsedIds,
    columnVisibility,
    configChangeReview,
    createMember,
    createProject,
    createProjectIssue,
    createProjectWorkLog,
    createTeam,
    currentDraftRef,
    currentReviewSchedules,
    currentUser,
    deleteProjectAttachment,
    deleteProjectWorkLog,
    dismissToast,
    displayedResourceRows,
    displayedResourceWeeks,
    exportProject,
    favoriteProjectIds,
    filterOpen,
    filters,
    ganttColumns,
    ganttDisplayMode,
    hasUnsavedChanges,
    healthReport,
    helpDocumentId,
    importBrabioXlsx,
    importExistingProject,
    importProject,
    importTaskCsv,
    lastSavedAt,
    loadingProjectId,
    localDraftChangeSummary,
    managementTeam,
    memberAssignmentCounts,
    navigateToProjectView,
    nextProjectIndex,
    onLogout,
    openHelpPage,
    openHealthIssue,
    openMasterSettings,
    openProjectCreateSheet,
    openProjectSettings,
    openTaskInspector,
    pendingProjectImport,
    pendingTaskCsvImport,
    projectMembers,
    projectSummaries,
    recordActivity,
    requestSaveDraft,
    resetDraft,
    resourceDisplaySettings,
    resourceRows,
    resourceScope,
    restoreProject,
    retryApiSync,
    saveDraft,
    saveScopeLabel,
    scale,
    schedule,
    selectTask,
    selectTaskFromSecondaryView,
    selectTaskRange,
    selectedTaskId,
    selectedTaskIds,
    setActiveTourId,
    setCalendarAware,
    setColumnVisibility,
    setFilterOpen,
    setFilters,
    setGanttDisplayMode,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setResourceDisplaySettings,
    setResourceScope,
    setScale,
    setShowCreateSheet,
    setShowProjectCreateSheet,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    setTimeUnit,
    setTodaySignal,
    showCreateSheet,
    showHelpPage,
    showMainProjectViews,
    showMasterSettings,
    showProjectCreateSheet,
    showProjectSettings,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
    startTour,
    stats,
    syncQueueItems,
    syncStatus,
    taskActions,
    taskChangeReview,
    taskClipboard,
    taskFocusRequest,
    taskInspectorTask,
    tasks,
    taskStartFocusSignal,
    taskTitleEditRequest,
    teamResourcesLoading,
    timeUnit,
    timeline,
    todaySignal,
    toasts,
    toggleCollapsed,
    toggleFavoriteProject,
    toggleTeamMember,
    topbarNotifications,
    updateCalendar,
    updateMember,
    updateMemberLifecycle,
    updatePendingTaskCsvMapping,
    updateProjectIssue,
    updateProjectLifecycleStatus,
    updateProjectSettings,
    updateProjectStaffing,
    updateProjectWorkLog,
    updateStatusFilter,
    updateTeam,
    updateTeamCalendarMaster,
    visibleRows,
    workspace,
    workspaceConfigChangeReview,
    workspaceProjects,
    workspaceTaskChangeReview,
  };
}
