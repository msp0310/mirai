import type { AppWorkbenchController } from "../AppWorkbench";
import { WorkbenchMainViews } from "./WorkbenchMainViews";
import { WorkbenchSidebar, WorkbenchTopbar } from "./WorkbenchNavigation";
import { WorkbenchOverlays } from "./WorkbenchOverlays";

type AppWorkbenchViewProps = {
  controller: AppWorkbenchController;
};

/** 認証後シェルを構成し、各領域の描画責務を専用コンポーネントへ委譲します。 */
export function AppWorkbenchView({ controller }: AppWorkbenchViewProps) {
  const { loadingProjectId, teamResourcesLoading } = controller;

  return (
    <div className="app-shell">
      <WorkbenchSidebar controller={controller} />
      <main className="workspace">
        {loadingProjectId || teamResourcesLoading ? (
          <div className="project-loading-indicator" role="status">
            <span className="loading-spinner" />
            {teamResourcesLoading ? "チーム案件を読み込み中..." : "案件詳細を読み込み中..."}
          </div>
        ) : null}
        <WorkbenchTopbar controller={controller} />
        <WorkbenchMainViews controller={controller} />
      </main>
      <WorkbenchOverlays controller={controller} />
    </div>
  );
}
