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

/** 案件コンテキスト、保存状態、入出力をTopbarへ接続します。 */
export function WorkbenchTopbar({ controller }: WorkbenchNavigationProps) {
  const {
    activeTab,
    activeTeamId,
    activeTeamProjects,
    addToast,
    changeProject,
    changeTeam,
    currentUser,
    exportProject,
    favoriteProjectIds,
    hasUnsavedChanges,
    importBrabioXlsx,
    importProject,
    importTaskCsv,
    onLogout,
    openProjectSettings,
    requestSaveDraft,
    restoreProject,
    retryApiSync,
    schedule,
    setShowResetConfirm,
    showHelpPage,
    showMasterSettings,
    showProjectSettings,
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
      onExportProject={exportProject}
      onFavoriteToggle={toggleFavoriteProject}
      onImportBrabioXlsx={importBrabioXlsx}
      onImportProject={importProject}
      onImportTaskCsv={importTaskCsv}
      onLogout={onLogout}
      onProjectChange={changeProject}
      onProjectLinkCopy={(copied) =>
        addToast({
          detail: copied ? schedule.project.workspace : "リンク欄を選択してコピーしてください",
          title: copied ? "共有リンクをコピーしました" : "自動コピーできませんでした",
          tone: copied ? "success" : "warning",
        })
      }
      onProjectRestore={restoreProject}
      onProjectSettingsOpen={openProjectSettings}
      onResetDraft={() => setShowResetConfirm(true)}
      onRetryApiSync={retryApiSync}
      onSaveDraft={requestSaveDraft}
      onTeamChange={changeTeam}
      project={schedule.project}
      projectSettingsOpen={showProjectSettings}
      projects={activeTeamProjects}
      syncQueueItems={syncQueueItems}
      syncStatus={syncStatus}
      teams={workspace.teams}
    />
  );
}
