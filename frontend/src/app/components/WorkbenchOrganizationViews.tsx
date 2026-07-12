import { todayKey } from "../../features/gantt/components/constants";
import type { AppWorkbenchController } from "../AppWorkbench";
import {
  DailyReportPage,
  PersonalAnalyticsPage,
  ProjectPortfolioPanel,
  WorkloadOverviewPage,
} from "../workbenchLazyViews";

type WorkbenchOrganizationViewsProps = {
  controller: AppWorkbenchController;
};

/** 案件一覧、要員計画、日報、個人分析の横断画面を描画します。 */
export function WorkbenchOrganizationViews({ controller }: WorkbenchOrganizationViewsProps) {
  const {
    activeTab,
    activeTeamId,
    calendarAware,
    changeProject,
    changeTeam,
    currentReviewSchedules,
    currentUser,
    favoriteProjectIds,
    managementTeam,
    navigateToProjectView,
    openProjectCreateSheet,
    projectSummaries,
    schedule,
    showMainProjectViews,
    toggleFavoriteProject,
    updateProjectLifecycleStatus,
    updateProjectStaffing,
    workspace,
  } = controller;

  if (!showMainProjectViews) {
    return null;
  }

  return (
    <>
      {activeTab === "Projects" ? (
        <ProjectPortfolioPanel
          activeProjectId={schedule.project.id}
          activeTeamId={activeTeamId}
          calendarAware={calendarAware}
          favoriteProjectIds={favoriteProjectIds}
          onCreateProject={openProjectCreateSheet}
          onOpenProject={(projectId) => {
            if (changeProject(projectId)) {
              void navigateToProjectView(projectId, "Gantt");
            }
          }}
          onOpenProjectIssues={(projectId) => {
            if (changeProject(projectId)) {
              void navigateToProjectView(projectId, "Issues");
            }
          }}
          onSelectProject={changeProject}
          onTeamChange={(teamId) => changeTeam(teamId, { stayOnPortfolio: true })}
          onToggleFavoriteProject={toggleFavoriteProject}
          onUpdateProjectLifecycleStatus={updateProjectLifecycleStatus}
          projectSummaries={projectSummaries}
          schedules={currentReviewSchedules}
          teams={workspace.teams}
        />
      ) : null}
      {activeTab === "Workload" ? (
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
      {activeTab === "DailyReports" && managementTeam ? (
        <DailyReportPage
          currentUser={currentUser}
          schedules={currentReviewSchedules}
          team={managementTeam}
          todayKey={todayKey}
        />
      ) : null}
      {activeTab === "PersonalAnalytics" ? (
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
    </>
  );
}
