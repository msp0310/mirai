import { tourScenarios } from "../../features/onboarding/tourScenarios";
import type { AppWorkbenchController } from "../AppWorkbench";
import { HelpPage, MasterSettingsPage, ProjectSettingsPage } from "../workbenchLazyViews";

type WorkbenchConfigurationViewsProps = {
  controller: AppWorkbenchController;
};

/** 管理設定、案件設定、ヘルプの排他的な画面群を描画します。 */
export function WorkbenchConfigurationViews({ controller }: WorkbenchConfigurationViewsProps) {
  const {
    activeProjectCount,
    activeTeam,
    activeTeamReviewSchedules,
    archiveProject,
    availableTourIds,
    createMember,
    createTeam,
    currentUser,
    helpDocumentId,
    managementTeam,
    memberAssignmentCounts,
    schedule,
    showHelpPage,
    showMasterSettings,
    showProjectSettings,
    startTour,
    toggleTeamMember,
    updateMember,
    updateMemberLifecycle,
    updateProjectSettings,
    updateTeam,
    updateTeamCalendarMaster,
    workspace,
  } = controller;

  return (
    <>
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
    </>
  );
}
