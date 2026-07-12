import { type Dispatch, type SetStateAction, useCallback } from "react";

import type { ProjectSummary, ScheduleWorkspace } from "../../../data/scheduleRepository";
import type { ToastInput } from "../../../hooks/useToastQueue";
import { getOperationalProjectStatus, projectLifecycleLabels } from "../../../lib/projects";
import type { ActivityInput } from "../../../types/activity";
import type {
  CalendarDefinition,
  Member,
  Project,
  ProjectAssignment,
  ProjectLifecycleStatus,
  StaffingDemand,
} from "../../../types/schedule";

type UseProjectConfigurationActionsOptions = {
  activeProjectId: string;
  navigateToGantt: (projectId: string) => unknown;
  onActivity: (input: ActivityInput) => void;
  onToast: (input: ToastInput) => void;
  projectSummaries: ProjectSummary[];
  setActiveTeamId: (teamId: string) => void;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  workspace: ScheduleWorkspace;
};

/** 案件設定、要員計画、状態、カレンダーの更新境界をまとめます。 */
export function useProjectConfigurationActions({
  activeProjectId,
  navigateToGantt,
  onActivity,
  onToast,
  projectSummaries,
  setActiveTeamId,
  setWorkspace,
  workspace,
}: UseProjectConfigurationActionsOptions) {
  const updateProjectSettings = useCallback(
    (project: Project) => {
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
      void navigateToGantt(project.id);
      onToast({ detail: project.workspace, title: "プロジェクト設定を保存しました" });
      onActivity({
        category: "project",
        detail: `${getOperationalProjectStatus(project)} / ${project.memberIds?.length ?? 0}名 / ${project.rangeStart} - ${project.rangeEnd}`,
        projectId: project.id,
        title: "プロジェクト設定を更新しました",
        tone: "success",
      });
    },
    [navigateToGantt, onActivity, onToast, setActiveTeamId, setWorkspace],
  );

  const updateProjectStaffing = useCallback(
    (projectId: string, assignments: ProjectAssignment[], staffingDemands: StaffingDemand[]) => {
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
      onToast({ detail: "保存するとAPIへ反映されます。", title: "要員計画を更新しました" });
    },
    [onToast, setWorkspace],
  );

  const updateProjectLifecycleStatus = useCallback(
    (projectId: string, lifecycleStatus: ProjectLifecycleStatus) => {
      const targetSchedule = workspace.schedules.find(
        (snapshot) => snapshot.project.id === projectId,
      );
      const targetSummary = projectSummaries.find((summary) => summary.project.id === projectId);
      const targetProject = targetSchedule?.project ?? targetSummary?.project;
      if (!targetProject) {
        return;
      }
      const nextProject = { ...targetProject, lifecycleStatus };
      setWorkspace((current) => ({
        ...current,
        projectSummaries: (current.projectSummaries ?? []).map((summary) =>
          summary.project.id === projectId ? { ...summary, project: nextProject } : summary,
        ),
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.id === projectId ? { ...snapshot, project: nextProject } : snapshot,
        ),
      }));
      onToast({
        detail: targetProject.workspace,
        title: `ステータスを${projectLifecycleLabels[lifecycleStatus]}に変更しました`,
        tone: lifecycleStatus === "completed" ? "success" : "info",
      });
      onActivity({
        category: "project",
        detail: `${targetProject.workspace} を${projectLifecycleLabels[lifecycleStatus]}にしました。`,
        projectId,
        title: "プロジェクトステータスを更新しました",
        tone: lifecycleStatus === "completed" ? "success" : "info",
      });
    },
    [onActivity, onToast, projectSummaries, setWorkspace, workspace.schedules],
  );

  const updateCalendar = useCallback(
    (calendar: CalendarDefinition) => {
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.id === activeProjectId ? { ...snapshot, calendar } : snapshot,
        ),
      }));
      onActivity({
        category: "calendar",
        detail: `稼働曜日 ${calendar.workWeek.length}件 / 休日 ${calendar.holidays.length}件`,
        title: "カレンダーを更新しました",
        tone: "info",
      });
    },
    [activeProjectId, onActivity, setWorkspace],
  );

  return {
    updateCalendar,
    updateProjectLifecycleStatus,
    updateProjectSettings,
    updateProjectStaffing,
  };
}
