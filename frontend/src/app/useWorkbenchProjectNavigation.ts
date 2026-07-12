import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ViewTab } from "../components/layout/ViewTabs";
import { apiScheduleRepository } from "../data/apiScheduleRepository";
import { createProjectFromTemplate } from "../data/projectTemplates";
import type {
  ProjectSummary,
  ScheduleSnapshot,
  ScheduleWorkspace,
} from "../data/scheduleRepository";
import type { CreateProjectTemplateInput } from "../features/projects/components/ProjectCreateSheet";
import type { ToastInput } from "../hooks/useToastQueue";
import { getActiveMembers } from "../lib/members";
import { isProjectArchived } from "../lib/projects";
import { createProjectSummaryFromSnapshot } from "../lib/projectSummary";
import { mergeScheduleIntoWorkspace } from "../lib/scheduleWorkspace";
import type { ActivityInput } from "../types/activity";
import type { ScheduleTask, Team } from "../types/schedule";

type UseWorkbenchProjectNavigationOptions = {
  activeProjectId: string;
  activeTab: ViewTab;
  activeTeam?: Team;
  activeTeamId: string;
  addToast: (input: ToastInput) => void;
  calendarAware: boolean;
  clearTaskSelection: () => void;
  closeTransientUi: () => void;
  initialFavoriteProjectIds: Set<string>;
  initializeProject: (projectId: string, tasks: ScheduleTask[]) => void;
  navigateToProjectView: (
    projectId: string,
    tab?: ViewTab,
    options?: { replace?: boolean },
  ) => unknown;
  persistNavigationState: (projectId: string, teamId: string | null) => void;
  projectSummaries: ProjectSummary[];
  recordActivity: (input: ActivityInput) => void;
  replaceProject: (projectId: string, tasks: ScheduleTask[]) => void;
  schedule: ScheduleSnapshot;
  selectOnlyTask: (taskId: string | null) => void;
  setActiveProjectId: (projectId: string) => void;
  setActiveTab: (tab: ViewTab) => unknown;
  setActiveTeamId: (teamId: string) => void;
  setCollapsedIdsForProject: (projectId: string, ids: Set<string>) => void;
  setFilterOpen: (open: boolean) => void;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  workspace: ScheduleWorkspace;
};

type ActivateProjectOptions = {
  historyMode?: "push" | "replace";
  updateRoute?: boolean;
};

/** 案件の遅延読込、切替、作成、アーカイブを一つのナビゲーション境界で管理します。 */
export function useWorkbenchProjectNavigation({
  activeProjectId,
  activeTab,
  activeTeam,
  activeTeamId,
  addToast,
  calendarAware,
  clearTaskSelection,
  closeTransientUi,
  initialFavoriteProjectIds,
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
}: UseWorkbenchProjectNavigationOptions) {
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<Set<string>>(
    () => new Set(initialFavoriteProjectIds),
  );
  const projectLoadRequestIdRef = useRef(0);
  const nextProjectIndex = useMemo(
    () =>
      projectSummaries.filter(
        (summary) =>
          summary.project.teamId === (activeTeamId || null) && !isProjectArchived(summary.project),
      ).length + 1,
    [activeTeamId, projectSummaries],
  );

  const activateProject = useCallback(
    (projectId: string, options: ActivateProjectOptions = {}) => {
      const nextSchedule = workspace.schedules.find(
        (snapshot) => snapshot.project.id === projectId,
      );
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
        closeTransientUi();
        setFilterOpen(false);
        if (options.updateRoute !== false && activeTab !== "Projects") {
          void navigateToProjectView(loadedSchedule.project.id, activeTab, {
            replace: options.historyMode === "replace",
          });
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
    },
    [
      activeTab,
      addToast,
      clearTaskSelection,
      closeTransientUi,
      initializeProject,
      loadingProjectId,
      navigateToProjectView,
      persistNavigationState,
      projectSummaries,
      setActiveProjectId,
      setActiveTeamId,
      setFilterOpen,
      setWorkspace,
      workspace.schedules,
    ],
  );

  const changeTeam = useCallback(
    (teamId: string, options: { stayOnPortfolio?: boolean } = {}) => {
      const firstProject = projectSummaries.find(
        (summary) => summary.project.teamId === teamId && !isProjectArchived(summary.project),
      )?.project;
      if (firstProject) {
        activateProject(firstProject.id, { updateRoute: !options.stayOnPortfolio });
        if (options.stayOnPortfolio) {
          void setActiveTab("Projects");
        }
        return;
      }
      setActiveTeamId(teamId);
      void setActiveTab("Projects");
      clearTaskSelection();
      closeTransientUi();
      persistNavigationState(activeProjectId, teamId);
    },
    [
      activateProject,
      activeProjectId,
      clearTaskSelection,
      closeTransientUi,
      persistNavigationState,
      projectSummaries,
      setActiveTab,
      setActiveTeamId,
    ],
  );

  const createProject = useCallback(
    async (input: CreateProjectTemplateInput) => {
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
      void navigateToProjectView(createdSchedule.project.id, "Gantt");
      selectOnlyTask(createdSchedule.tasks[0]?.id ?? null);
      setCollapsedIdsForProject(createdSchedule.project.id, new Set());
      closeTransientUi();
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
    },
    [
      activeTeam,
      activeTeamId,
      addToast,
      calendarAware,
      closeTransientUi,
      navigateToProjectView,
      nextProjectIndex,
      recordActivity,
      replaceProject,
      schedule.calendar,
      schedule.members,
      selectOnlyTask,
      setActiveProjectId,
      setActiveTeamId,
      setCollapsedIdsForProject,
      setWorkspace,
    ],
  );

  const archiveProject = useCallback(
    (projectId: string) => {
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
                project: { ...snapshot.project, archivedAt, status: "archived" },
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
      void navigateToProjectView(fallbackSchedule.project.id, "Gantt", { replace: true });
      clearTaskSelection();
      closeTransientUi();
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
    },
    [
      addToast,
      clearTaskSelection,
      closeTransientUi,
      navigateToProjectView,
      persistNavigationState,
      recordActivity,
      setActiveProjectId,
      setActiveTeamId,
      setWorkspace,
      workspace.schedules,
    ],
  );

  const restoreProject = useCallback(
    (projectId: string) => {
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
          return { ...snapshot, project: { ...project, status: "active" } };
        }),
      }));
      setActiveTeamId(targetSchedule.project.teamId ?? "");
      setActiveProjectId(projectId);
      persistNavigationState(projectId, targetSchedule.project.teamId);
      void navigateToProjectView(projectId, "Gantt");
      clearTaskSelection();
      closeTransientUi();
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
    },
    [
      addToast,
      clearTaskSelection,
      closeTransientUi,
      navigateToProjectView,
      persistNavigationState,
      recordActivity,
      setActiveProjectId,
      setActiveTeamId,
      setWorkspace,
      workspace.schedules,
    ],
  );

  const toggleFavoriteProject = useCallback(
    (projectId = schedule.project.id) => {
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
    },
    [
      addToast,
      favoriteProjectIds,
      projectSummaries,
      recordActivity,
      schedule.project,
      workspace.schedules,
    ],
  );

  const removeFavoriteProject = useCallback((projectId: string) => {
    setFavoriteProjectIds((current) => {
      if (!current.has(projectId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
  }, []);

  return {
    activateProject,
    archiveProject,
    changeProject: activateProject,
    changeTeam,
    createProject,
    favoriteProjectIds,
    loadingProjectId,
    nextProjectIndex,
    removeFavoriteProject,
    restoreProject,
    toggleFavoriteProject,
  };
}
