import { PlusIcon } from "@heroicons/react/24/outline";

import type { ProjectSummary, ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { ProjectLifecycleStatus, Team } from "../../../types/schedule";
import { useProjectPortfolio } from "../hooks/useProjectPortfolio";
import { PortfolioControls } from "./portfolio/PortfolioControls";
import { PortfolioHeader } from "./portfolio/PortfolioHeader";
import { PortfolioSidePanels } from "./portfolio/PortfolioSidePanels";
import { PortfolioSummary } from "./portfolio/PortfolioSummary";
import { ProjectPortfolioCard } from "./ProjectPortfolioCard";

type ProjectPortfolioPanelProps = {
  activeProjectId: string;
  activeTeamId: string;
  calendarAware: boolean;
  favoriteProjectIds: Set<string>;
  onCreateProject: () => void;
  onOpenProjectIssues: (projectId: string) => void;
  onOpenProject: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onTeamChange: (teamId: string) => void;
  onToggleFavoriteProject: (projectId: string) => void;
  onUpdateProjectLifecycleStatus: (projectId: string, status: ProjectLifecycleStatus) => void;
  projectSummaries: ProjectSummary[];
  schedules: ScheduleSnapshot[];
  teams: Team[];
};

/** チーム選択、案件カード、横断状況を共通View Modelで構成します。 */
export function ProjectPortfolioPanel({
  activeProjectId,
  activeTeamId,
  calendarAware,
  favoriteProjectIds,
  onCreateProject,
  onOpenProjectIssues,
  onOpenProject,
  onSelectProject,
  onTeamChange,
  onToggleFavoriteProject,
  onUpdateProjectLifecycleStatus,
  projectSummaries,
  schedules,
  teams,
}: ProjectPortfolioPanelProps) {
  const model = useProjectPortfolio({
    activeTeamId,
    calendarAware,
    favoriteProjectIds,
    projectSummaries,
    schedules,
    teams,
  });

  return (
    <section className="portfolio-page" aria-label="プロジェクト一覧">
      <PortfolioHeader
        activeTeamId={activeTeamId}
        onCreateProject={onCreateProject}
        onTeamChange={onTeamChange}
        team={model.team}
        teamCards={model.teamCards}
      />
      <PortfolioSummary
        allItemCount={model.allItems.length}
        attentionProjectCount={model.attentionProjectCount}
        averageProgress={model.averageProgress}
        completedTasks={model.completedTasks}
        filteredItemCount={model.filteredItems.length}
        hasActiveFilter={model.hasActiveFilter}
        lifecycleCounts={model.lifecycleCounts}
        nextMilestone={model.nextMilestones[0]}
        totalTasks={model.totalTasks}
      />
      <PortfolioControls
        filter={model.filter}
        onFilterChange={model.setFilter}
        onQueryChange={model.setQuery}
        onSortChange={model.setSort}
        query={model.query}
        sort={model.sort}
      />
      <div className="portfolio-layout">
        <div className="portfolio-project-list" data-tour="portfolio-projects">
          {model.filteredItems.map((item) => (
            <ProjectPortfolioCard
              active={item.project.id === activeProjectId}
              item={item}
              key={item.project.id}
              onOpenProject={onOpenProject}
              onSelectProject={onSelectProject}
              onToggleFavoriteProject={onToggleFavoriteProject}
              onUpdateProjectLifecycleStatus={onUpdateProjectLifecycleStatus}
            />
          ))}
          {model.allItems.length === 0 ? (
            <div className="portfolio-empty">
              <strong>このチームには有効なプロジェクトがありません</strong>
              <button className="primary-button" onClick={onCreateProject} type="button">
                <PlusIcon />
                プロジェクト追加
              </button>
            </div>
          ) : null}
          {model.allItems.length > 0 && model.filteredItems.length === 0 ? (
            <div className="portfolio-empty">
              <strong>条件に一致するプロジェクトはありません</strong>
              <button className="subtle-action" onClick={model.clearFilters} type="button">
                条件をクリア
              </button>
            </div>
          ) : null}
        </div>
        <PortfolioSidePanels
          attentionItems={model.attentionItems}
          maxWorkloadHours={model.maxWorkloadHours}
          nextMilestones={model.nextMilestones}
          onOpenProject={onOpenProject}
          onOpenProjectIssues={onOpenProjectIssues}
          teamDetailsComplete={model.teamDetailsComplete}
          teamWorkloads={model.teamWorkloads}
        />
      </div>
    </section>
  );
}
