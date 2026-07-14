import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import type { AppWorkbenchController } from "../AppWorkbench";

type WorkbenchNavigationProps = {
  controller: AppWorkbenchController;
};

/** 現在地と権限に応じたサイドナビゲーションを表示します。 */
export function WorkbenchSidebar({ controller }: WorkbenchNavigationProps) {
  const {
    activeTab,
    changeTab,
    currentUser,
    exportProject,
    importBrabioXlsx,
    importProject,
    importTaskCsv,
    openHelpPage,
    openMasterSettings,
    openProjectSettings,
    schedule,
    showHelpPage,
    showMasterSettings,
    showProjectSettings,
  } = controller;

  return (
    <Sidebar
      activeTab={activeTab}
      helpOpen={showHelpPage}
      onHelp={openHelpPage}
      onExportProject={exportProject}
      onImportBrabioXlsx={importBrabioXlsx}
      onImportProject={importProject}
      onImportTaskCsv={importTaskCsv}
      onMasterSettingsOpen={openMasterSettings}
      onNavigate={changeTab}
      onProjectSettingsOpen={openProjectSettings}
      projectName={schedule.project.workspace}
      projectNo={schedule.project.projectNo ?? schedule.project.name}
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
      projectStatusLabel={
        schedule.project.lifecycleStatus === "planning"
          ? "計画"
          : schedule.project.lifecycleStatus === "completed"
            ? "完了"
            : "進行中"
      }
      settingsOpen={showMasterSettings}
      showAdminSettings={
        currentUser.role === "admin" || (schedule.access?.canManageStaffing ?? false)
      }
      showProjectSettings={schedule.access?.canManageProject ?? true}
    />
  );
}

/** 案件コンテキストと保存状態をTopbarへ接続します。 */
export function WorkbenchTopbar({ controller }: WorkbenchNavigationProps) {
  const {
    activeTab,
    activeTeamId,
    activeTeamProjects,
    changeProject,
    changeTeam,
    currentUser,
    favoriteProjectIds,
    hasUnsavedChanges,
    onLogout,
    requestSaveDraft,
    restoreProject,
    retryApiSync,
    schedule,
    setShowResetConfirm,
    showHelpPage,
    showMasterSettings,
    syncQueueItems,
    syncStatus,
    toggleFavoriteProject,
    topbarNotifications,
    workspace,
    workspaceProjects,
  } = controller;

  return (
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
      onFavoriteToggle={toggleFavoriteProject}
      onLogout={onLogout}
      onProjectChange={changeProject}
      onProjectRestore={restoreProject}
      onResetDraft={() => setShowResetConfirm(true)}
      onRetryApiSync={retryApiSync}
      onSaveDraft={requestSaveDraft}
      onTeamChange={changeTeam}
      project={schedule.project}
      projects={activeTeamProjects}
      syncQueueItems={syncQueueItems}
      syncStatus={syncStatus}
      teams={workspace.teams}
    />
  );
}
