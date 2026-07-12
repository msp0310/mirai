import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { ViewTab } from "../../../components/layout/ViewTabs";
import type { ScheduleWorkspace } from "../../../data/scheduleRepository";
import type { ToastInput } from "../../../hooks/useToastQueue";
import type { ActivityInput } from "../../../types/activity";
import type {
  PendingProjectImport,
  PendingTaskCsvImport,
  TaskCsvImportOptions,
} from "../../../types/projectImport";
import type { Project, ScheduleTask, Team } from "../../../types/schedule";
import type { ProjectImportMode } from "../components/ProjectImportSheet";
import {
  getTaskImportSourceLabel,
  mergeTaskImportIntoWorkspace,
  prepareProjectImport,
  prepareTaskImport,
} from "../lib/projectImportService";

type UseProjectImportCommitActionsOptions = {
  activeTeam?: Team;
  activeTeamId: string;
  clearTaskSelection: () => void;
  commitTasks: (updater: (current: ScheduleTask[]) => ScheduleTask[]) => void;
  navigateToProjectView: (projectId: string, tab?: ViewTab) => unknown;
  onToast: (input: ToastInput) => void;
  pendingProjectImport: PendingProjectImport | null;
  pendingTaskCsvImport: PendingTaskCsvImport | null;
  project: Project;
  recordActivity: (input: ActivityInput) => void;
  removeFavoriteProject: (projectId: string) => void;
  replaceProject: (projectId: string, tasks: ScheduleTask[]) => void;
  selectOnlyTask: (taskId: string | null) => void;
  setActiveProjectId: (projectId: string) => void;
  setActiveTab: (tab: ViewTab) => unknown;
  setActiveTeamId: (teamId: string) => void;
  setCollapsedIds: (ids: Set<string>) => void;
  setCollapsedIdsForProject: (projectId: string, ids: Set<string>) => void;
  setPendingProjectImport: Dispatch<SetStateAction<PendingProjectImport | null>>;
  setPendingTaskCsvImport: Dispatch<SetStateAction<PendingTaskCsvImport | null>>;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  workspace: ScheduleWorkspace;
};

/** 確認済みの取込データを、案件またはワークスペースへ確定反映します。 */
export function useProjectImportCommitActions({
  activeTeam,
  activeTeamId,
  clearTaskSelection,
  commitTasks,
  navigateToProjectView,
  onToast,
  pendingProjectImport,
  pendingTaskCsvImport,
  project,
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
}: UseProjectImportCommitActionsOptions) {
  const applyPendingTaskImport = useCallback(
    (options: TaskCsvImportOptions) => {
      if (!pendingTaskCsvImport) {
        return;
      }
      const prepared = prepareTaskImport(pendingTaskCsvImport, options, project);
      if (!prepared) {
        onToast({
          detail: "インポート確認のエラーを解消してください。",
          title: `${getTaskImportSourceLabel(pendingTaskCsvImport.sourceKind)}を読み込めませんでした`,
          tone: "warning",
        });
        return;
      }

      const { membersToCreate, nextProject, nextTasks, sourceLabel } = prepared;
      commitTasks(() => nextTasks);
      if (nextProject !== project || membersToCreate.length > 0) {
        setWorkspace((current) =>
          mergeTaskImportIntoWorkspace(
            current,
            project.id,
            nextProject,
            membersToCreate,
            activeTeam?.id,
          ),
        );
      }
      void setActiveTab("Gantt");
      setCollapsedIds(new Set());
      selectOnlyTask(nextTasks[0]?.id ?? null);
      setPendingTaskCsvImport(null);
      onToast({
        detail:
          nextProject !== project
            ? `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行 / 期間拡張`
            : `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行`,
        title: `${sourceLabel}を取り込みました`,
        tone: "info",
      });
      recordActivity({
        category: "import",
        detail:
          nextProject !== project
            ? `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行を反映し、プロジェクト期間を${nextProject.rangeStart} - ${nextProject.rangeEnd}へ広げました。`
            : `${pendingTaskCsvImport.fileName} / ${nextTasks.length}行を${project.workspace}へ反映しました。`,
        title: `${sourceLabel}を取り込みました`,
        tone: "success",
      });
    },
    [
      activeTeam?.id,
      commitTasks,
      onToast,
      pendingTaskCsvImport,
      project,
      recordActivity,
      selectOnlyTask,
      setActiveTab,
      setCollapsedIds,
      setPendingTaskCsvImport,
      setWorkspace,
    ],
  );

  const applyPendingProjectImport = useCallback(
    (mode: ProjectImportMode) => {
      if (!pendingProjectImport) {
        return;
      }
      if (pendingProjectImport.validation.errors.length > 0) {
        onToast({
          detail: "インポート確認のエラーを解消してください。",
          title: "JSONを読み込めませんでした",
          tone: "warning",
        });
        return;
      }

      const {
        importedProjectId,
        nextSchedule,
        nextTasks,
        nextTeam,
        nextTeamId,
        projectIdChanged,
        replaceExisting,
      } = prepareProjectImport(pendingProjectImport, mode, workspace, activeTeamId);

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
      if (replaceExisting && projectIdChanged) {
        removeFavoriteProject(pendingProjectImport.data.project.id);
      }
      setActiveTeamId(nextTeamId ?? "");
      setActiveProjectId(importedProjectId);
      void navigateToProjectView(importedProjectId, "Gantt");
      setCollapsedIdsForProject(importedProjectId, new Set());
      clearTaskSelection();
      setPendingProjectImport(null);
      setPendingTaskCsvImport(null);
      onToast({
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
    },
    [
      activeTeamId,
      clearTaskSelection,
      navigateToProjectView,
      onToast,
      pendingProjectImport,
      recordActivity,
      removeFavoriteProject,
      replaceProject,
      setActiveProjectId,
      setActiveTeamId,
      setCollapsedIdsForProject,
      setPendingProjectImport,
      setPendingTaskCsvImport,
      setWorkspace,
      workspace,
    ],
  );

  return { applyPendingProjectImport, applyPendingTaskImport };
}
