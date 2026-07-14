import { useCallback, useEffect } from "react";

import { TopbarAccount } from "./topbar/TopbarAccount";
import { TopbarContextPicker } from "./topbar/TopbarContextPicker";
import { TopbarNotifications } from "./topbar/TopbarNotifications";
import { getTopbarContextPresentation } from "./topbar/topbarPresentation";
import { TopbarSyncControls } from "./topbar/TopbarSyncControls";
import type { TopbarProps } from "./topbar/types";
import { useTopbarMenu } from "./topbar/useTopbarMenu";

export type {
  ExportFormat,
  TopbarAuthUser,
  TopbarContextMode,
  TopbarNotification,
  TopbarSyncQueueItem,
  TopbarSyncStatus,
} from "./topbar/types";

/** 共通ヘッダー内の現在地と操作群を調停します。 */
export function Topbar({
  activeTeamId,
  allProjects,
  contextMode,
  currentUser,
  favorite,
  favoriteProjectIds,
  hasUnsavedChanges,
  notifications,
  onFavoriteToggle,
  onLogout,
  onProjectChange,
  onProjectRestore,
  onResetDraft,
  onRetryApiSync,
  onSaveDraft,
  onTeamChange,
  project,
  projects,
  syncQueueItems,
  syncStatus,
  teams,
}: TopbarProps) {
  const { closeMenu, openMenu, setOpenMenu, toggleMenu, topbarRef } = useTopbarMenu();
  const presentation = getTopbarContextPresentation(contextMode, project);
  const openProjectMenu = useCallback(() => setOpenMenu("projects"), [setOpenMenu]);

  useEffect(() => {
    if (!presentation.projectSearchAvailable && openMenu === "projects") {
      closeMenu();
    }
  }, [closeMenu, openMenu, presentation.projectSearchAvailable]);

  return (
    <header className="topbar" data-context-mode={contextMode} ref={topbarRef}>
      <TopbarContextPicker
        activeTeamId={activeTeamId}
        allProjects={allProjects}
        contextMode={contextMode}
        favorite={favorite}
        favoriteProjectIds={favoriteProjectIds}
        onFavoriteToggle={onFavoriteToggle}
        onMenuClose={closeMenu}
        onMenuOpen={openProjectMenu}
        onProjectChange={onProjectChange}
        onProjectRestore={onProjectRestore}
        onTeamChange={onTeamChange}
        open={openMenu === "projects"}
        project={project}
        projects={projects}
        teams={teams}
      />

      <div className="topbar-actions">
        {presentation.syncActionsVisible ? (
          <TopbarSyncControls
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={closeMenu}
            onResetDraft={onResetDraft}
            onRetryApiSync={onRetryApiSync}
            onSaveDraft={onSaveDraft}
            onToggle={() => toggleMenu("sync")}
            open={openMenu === "sync"}
            queueItems={syncQueueItems}
            status={syncStatus}
          />
        ) : null}
        <TopbarNotifications
          notifications={notifications}
          onToggle={() => toggleMenu("notifications")}
          open={openMenu === "notifications"}
        />
        <TopbarAccount
          currentUser={currentUser}
          onClose={closeMenu}
          onLogout={onLogout}
          onToggle={() => toggleMenu("account")}
          open={openMenu === "account"}
        />
      </div>
    </header>
  );
}
