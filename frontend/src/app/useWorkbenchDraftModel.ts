import { useMemo } from "react";

import type { ViewTab } from "../components/layout/ViewTabs";
import type { ScheduleSnapshot, ScheduleWorkspace } from "../data/scheduleRepository";
import {
  buildTaskChangeReview,
  buildWorkspaceConfigChangeReview,
  buildWorkspaceTaskChangeReview,
} from "../lib/changeReview";
import type { ScheduleTask } from "../types/schedule";
import {
  createConfigChangeReviewFromRows,
  createDraftSignature,
  createLocalDraftChangeSummary,
  createPersistableDraft,
} from "./appState";
import type { ApiSyncState, PersistableDraft } from "./appTypes";
import { buildTopbarSyncQueueItems, createTopbarSyncStatus } from "./syncPresentation";

type DraftInput = Parameters<typeof createPersistableDraft>[0];

type UseWorkbenchDraftModelOptions = {
  activeTab: ViewTab;
  apiSyncState: ApiSyncState;
  currentReviewSchedules: ScheduleSnapshot[];
  draftInput: DraftInput;
  lastSavedAt: string | null;
  savedDraft: PersistableDraft;
  savedSignature: string;
  savedWorkspace: ScheduleWorkspace;
  schedule: ScheduleSnapshot;
  showHelpPage: boolean;
  showMasterSettings: boolean;
  tasks: ScheduleTask[];
};

/** 保存範囲、タスク・設定差分、同期状態を一つの読み取り専用モデルへ集約します。 */
export function useWorkbenchDraftModel({
  activeTab,
  apiSyncState,
  currentReviewSchedules,
  draftInput,
  lastSavedAt,
  savedDraft,
  savedSignature,
  savedWorkspace,
  schedule,
  showHelpPage,
  showMasterSettings,
  tasks,
}: UseWorkbenchDraftModelOptions) {
  const currentDraft = useMemo(() => createPersistableDraft(draftInput), [draftInput]);
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
  const saveScopeLabel = isProjectSaveScope
    ? activeTab === "Issues" || activeTab === "WorkLogs"
      ? "この案件"
      : "このガント"
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
  const hasUnsavedChanges = createDraftSignature(currentDraft) !== savedSignature;
  const localDraftChangeSummary = useMemo(
    () => createLocalDraftChangeSummary(currentDraft, savedDraft),
    [currentDraft, savedDraft, savedSignature],
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
      localDraftChangeSummary,
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

  return {
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
  };
}
