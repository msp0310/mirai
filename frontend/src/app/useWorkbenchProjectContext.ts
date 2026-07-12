import { useMemo } from "react";

import type { ScheduleWorkspace } from "../data/scheduleRepository";
import type { TourId } from "../features/onboarding/tourScenarios";
import { isProjectArchived } from "../lib/projects";
import { createProjectSummaryFromSnapshot } from "../lib/projectSummary";

type UseWorkbenchProjectContextOptions = {
  activeProjectId: string;
  activeTeamId: string;
  currentUserRole: string;
  workspace: ScheduleWorkspace;
};

/** 選択中のチーム・案件と、その文脈で利用できる権限を導出します。 */
export function useWorkbenchProjectContext({
  activeProjectId,
  activeTeamId,
  currentUserRole,
  workspace,
}: UseWorkbenchProjectContextOptions) {
  const projectSummaries = useMemo(
    () => workspace.projectSummaries ?? workspace.schedules.map(createProjectSummaryFromSnapshot),
    [workspace.projectSummaries, workspace.schedules],
  );
  const activeTeamProjects = useMemo(
    () =>
      projectSummaries
        .map((summary) => summary.project)
        .filter(
          (project) => project.teamId === (activeTeamId || null) && !isProjectArchived(project),
        ),
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
  const canEditPlan = schedule.access?.canEditPlan ?? true;
  const canEnterActual = schedule.access?.canEnterActual ?? true;
  const availableTourIds = useMemo<TourId[]>(() => {
    const ids: TourId[] = ["basic", "gantt", "member"];
    if (canEditPlan) {
      ids.push("planner");
    }
    if (currentUserRole === "admin") {
      ids.push("admin");
    }
    return ids;
  }, [canEditPlan, currentUserRole]);
  const activeTeam = workspace.teams.find((team) => team.id === schedule.project.teamId);
  const managementTeam =
    workspace.teams.find((team) => team.id === activeTeamId) ?? activeTeam ?? workspace.teams[0];

  return {
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
  };
}
