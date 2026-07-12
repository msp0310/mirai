import {
  ArrowsUpDownIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { type ReactNode, useMemo, useState } from "react";

import type { ProjectSummary, ScheduleSnapshot } from "../../../data/scheduleRepository";
import { projectLifecycleOptions } from "../../../lib/projects";
import { formatShortDate } from "../../../lib/schedule";
import type { ProjectLifecycleStatus, Team } from "../../../types/schedule";
import {
  type PortfolioFilter,
  type PortfolioSort,
  buildPortfolioItem,
  buildPortfolioSummaryItem,
  buildTeamWorkloads,
  comparePortfolioItems,
  isAttentionProject,
  matchesPortfolioFilter,
  matchesPortfolioQuery,
} from "../projectPortfolioModel";
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

const portfolioFilterOptions: { label: string; value: PortfolioFilter }[] = [
  { label: "全件", value: "all" },
  { label: "計画", value: "planning" },
  { label: "進行中", value: "inProgress" },
  { label: "完了済み", value: "completed" },
  { label: "要対応", value: "attention" },
  { label: "お気に入り", value: "favorites" },
  { label: "低進捗", value: "lowProgress" },
];

const portfolioSortLabels: Record<PortfolioSort, string> = {
  milestone: "マイルストーンが近い順",
  name: "名称順",
  priority: "優先度順",
  progressAsc: "進捗が低い順",
  progressDesc: "進捗が高い順",
};

/** チーム配下のプロジェクトを一覧し、対象プロジェクトを選択します。 */
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
  const [filter, setFilter] = useState<PortfolioFilter>("inProgress");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PortfolioSort>("priority");
  const normalizedTeamId = activeTeamId || null;
  const team = teams.find((item) => item.id === activeTeamId);
  const teamSchedules = schedules.filter(
    (snapshot) =>
      snapshot.project.teamId === normalizedTeamId && snapshot.project.status !== "archived",
  );
  const teamProjectCount = projectSummaries.filter(
    (summary) =>
      summary.project.teamId === normalizedTeamId && summary.project.status !== "archived",
  ).length;
  const teamDetailsComplete = teamSchedules.length >= teamProjectCount;
  const schedulesByProjectId = useMemo(
    () => new Map(schedules.map((snapshot) => [snapshot.project.id, snapshot] as const)),
    [schedules],
  );
  const allItems = useMemo(
    () =>
      projectSummaries
        .filter(
          (summary) =>
            summary.project.teamId === normalizedTeamId && summary.project.status !== "archived",
        )
        .map((summary) => {
          const snapshot = schedulesByProjectId.get(summary.project.id);
          const projectTeam = teams.find((item) => item.id === summary.project.teamId);
          return snapshot
            ? buildPortfolioItem({
                calendarAware,
                favorite: favoriteProjectIds.has(summary.project.id),
                snapshot,
                team: projectTeam,
              })
            : buildPortfolioSummaryItem({
                favorite: favoriteProjectIds.has(summary.project.id),
                summary,
                team: projectTeam,
              });
        }),
    [
      normalizedTeamId,
      calendarAware,
      favoriteProjectIds,
      projectSummaries,
      schedulesByProjectId,
      teams,
    ],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      allItems
        .filter((item) => matchesPortfolioFilter(item, filter))
        .filter((item) => matchesPortfolioQuery(item, normalizedQuery))
        .sort((a, b) => comparePortfolioItems(a, b, sort)),
    [allItems, filter, normalizedQuery, sort],
  );
  const inProgressItems = allItems.filter((item) => item.lifecycleStatus === "inProgress");
  const attentionProjectCount = allItems.filter(isAttentionProject).length;
  const totalTasks = inProgressItems.reduce((sum, item) => sum + item.taskCount, 0);
  const completedTasks = inProgressItems.reduce((sum, item) => sum + item.completedCount, 0);
  const averageProgress =
    inProgressItems.length > 0
      ? Math.round(
          inProgressItems.reduce((sum, item) => sum + item.progress, 0) / inProgressItems.length,
        )
      : 0;
  const lifecycleCounts = Object.fromEntries(
    projectLifecycleOptions.map((option) => [
      option.value,
      allItems.filter((item) => item.lifecycleStatus === option.value).length,
    ]),
  ) as Record<ProjectLifecycleStatus, number>;
  const nextMilestones = filteredItems
    .filter((item) => item.lifecycleStatus !== "completed")
    .map((item) => ({
      milestone: item.nextMilestone,
      project: item.project,
    }))
    .toSorted((a, b) => a.milestone.start.localeCompare(b.milestone.start))
    .slice(0, 5);
  const attentionItems = allItems
    .filter(isAttentionProject)
    .toSorted((a, b) => comparePortfolioItems(a, b, "priority"))
    .slice(0, 5);
  const teamWorkloads = useMemo(
    () =>
      teamDetailsComplete
        ? buildTeamWorkloads({
            calendarAware,
            schedules: teamSchedules,
            team,
          })
        : [],
    [calendarAware, team, teamDetailsComplete, teamSchedules],
  );
  const maxWorkloadHours = Math.max(...teamWorkloads.map((item) => item.remainingHours), 1);
  const hasActiveFilter = filter !== "all" || normalizedQuery.length > 0;
  const teamCards = useMemo(
    () => [
      ...teams.map((item) => ({
        activeProjectCount: projectSummaries.filter(
          (summary) => summary.project.teamId === item.id && summary.project.status !== "archived",
        ).length,
        memberCount: item.memberIds.length,
        team: item,
      })),
      ...(projectSummaries.some((summary) => summary.project.teamId == null)
        ? [
            {
              activeProjectCount: projectSummaries.filter(
                (summary) =>
                  summary.project.teamId == null && summary.project.status !== "archived",
              ).length,
              memberCount: 0,
              team: null,
            },
          ]
        : []),
    ],
    [projectSummaries, teams],
  );

  return (
    <section className="portfolio-page" aria-label="プロジェクト一覧">
      <div className="portfolio-header">
        <div className="portfolio-heading">
          <span>選択中のチーム</span>
          <h2>{team?.name ?? "未所属"}</h2>
        </div>
        <div className="portfolio-header-actions">
          <button
            className="primary-button portfolio-add-button"
            onClick={onCreateProject}
            type="button"
          >
            <PlusIcon />
            プロジェクト追加
          </button>
        </div>
      </div>

      <div className="portfolio-team-strip" aria-label="チーム選択">
        {teamCards.map((item) => (
          <button
            aria-current={(item.team?.id ?? "") === activeTeamId ? "true" : undefined}
            className={
              (item.team?.id ?? "") === activeTeamId
                ? "portfolio-team-card active"
                : "portfolio-team-card"
            }
            key={item.team?.id ?? "unassigned"}
            onClick={() => onTeamChange(item.team?.id ?? "")}
            type="button"
          >
            <span>{item.team?.code ?? "未"}</span>
            <div>
              <strong>{item.team?.name ?? "未所属"}</strong>
              <small>
                {item.activeProjectCount}案件 / {item.memberCount}名
              </small>
            </div>
          </button>
        ))}
      </div>

      <div className="portfolio-summary">
        <PortfolioSummaryCard
          detail={`計画${lifecycleCounts.planning} / 進行${lifecycleCounts.inProgress} / 完了${lifecycleCounts.completed}`}
          label="管理中プロジェクト"
          value={
            hasActiveFilter
              ? `${filteredItems.length}/${allItems.length}件`
              : `${allItems.length}件`
          }
        />
        <PortfolioSummaryCard
          detail={`${completedTasks} / ${totalTasks} タスク完了`}
          label="平均進捗"
          tone={averageProgress >= 70 ? "good" : "blue"}
          value={`${averageProgress}%`}
        />
        <PortfolioSummaryCard
          detail={
            attentionProjectCount > 0
              ? "遅延または進捗35%未満の案件があります"
              : "要対応案件はありません"
          }
          label="要対応案件"
          tone={attentionProjectCount > 0 ? "hot" : "good"}
          value={`${attentionProjectCount}件`}
        />
        <PortfolioSummaryCard
          detail={
            nextMilestones[0]
              ? `${nextMilestones[0].project.workspace}`
              : "予定中のマイルストーンなし"
          }
          label="次の節目"
          value={nextMilestones[0] ? formatShortDate(nextMilestones[0].milestone.start) : "-"}
        />
      </div>

      <div
        className="portfolio-controls"
        aria-label="プロジェクト絞り込み"
        data-tour="portfolio-search"
      >
        <label className="portfolio-search">
          <MagnifyingGlassIcon />
          <input
            aria-label="プロジェクト検索"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="プロジェクトNo.・案件名・マイルストーンで検索"
            value={query}
          />
        </label>
        <div className="portfolio-filter-tabs" aria-label="状態フィルタ">
          {portfolioFilterOptions.map((option) => (
            <button
              className={filter === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="portfolio-sort">
          <ArrowsUpDownIcon />
          <select
            aria-label="プロジェクト並び替え"
            onChange={(event) => setSort(event.target.value as PortfolioSort)}
            value={sort}
          >
            {Object.entries(portfolioSortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="portfolio-layout">
        <div className="portfolio-project-list" data-tour="portfolio-projects">
          {filteredItems.map((item) => (
            <ProjectPortfolioCard
              active={item.project.id === activeProjectId}
              item={item}
              onOpenProject={onOpenProject}
              key={item.project.id}
              onSelectProject={onSelectProject}
              onToggleFavoriteProject={onToggleFavoriteProject}
              onUpdateProjectLifecycleStatus={onUpdateProjectLifecycleStatus}
            />
          ))}
          {allItems.length === 0 ? (
            <div className="portfolio-empty">
              <strong>このチームには有効なプロジェクトがありません</strong>
              <button className="primary-button" onClick={onCreateProject} type="button">
                <PlusIcon />
                プロジェクト追加
              </button>
            </div>
          ) : null}
          {allItems.length > 0 && filteredItems.length === 0 ? (
            <div className="portfolio-empty">
              <strong>条件に一致するプロジェクトはありません</strong>
              <button
                className="subtle-action"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
                type="button"
              >
                条件をクリア
              </button>
            </div>
          ) : null}
        </div>

        <aside className="portfolio-side" aria-label="プロジェクト横断状況">
          <section className="portfolio-side-panel">
            <PanelTitle
              detail={`${attentionItems.length}件`}
              icon={<ExclamationTriangleIcon />}
              title="要対応"
            />
            <div className="portfolio-attention-list">
              {attentionItems.map((item) => (
                <div className="portfolio-attention-row" key={item.project.id}>
                  <span>{item.delayedTasks.length > 0 ? "遅延" : "低進捗"}</span>
                  <button
                    className="portfolio-attention-project"
                    onClick={() => onOpenProject(item.project.id)}
                    type="button"
                  >
                    <strong>{item.project.workspace}</strong>
                    <small>{item.delayedTasks[0]?.title ?? `進捗 ${item.progress}%`}</small>
                  </button>
                  <button
                    className="portfolio-attention-action"
                    onClick={() => onOpenProjectIssues(item.project.id)}
                    type="button"
                  >
                    課題で対応
                  </button>
                </div>
              ))}
              {attentionItems.length === 0 ? (
                <p className="portfolio-side-empty">要対応案件はありません。</p>
              ) : null}
            </div>
          </section>

          <section className="portfolio-side-panel">
            <PanelTitle
              detail={`${nextMilestones.length}件`}
              icon={<FlagIcon />}
              title="近いマイルストーン"
            />
            <div className="portfolio-milestone-list">
              {nextMilestones.map(({ milestone, project }) => (
                <button
                  className="portfolio-milestone-row"
                  key={`${project.id}-${milestone.title}-${milestone.start}`}
                  onClick={() => onOpenProject(project.id)}
                  type="button"
                >
                  <span>{formatShortDate(milestone.start)}</span>
                  <div>
                    <strong>{milestone.title}</strong>
                    <small>{project.workspace}</small>
                  </div>
                </button>
              ))}
              {nextMilestones.length === 0 ? (
                <p className="portfolio-side-empty">予定中のマイルストーンはありません。</p>
              ) : null}
            </div>
          </section>

          {teamDetailsComplete ? (
            <section className="portfolio-side-panel">
              <PanelTitle
                detail={`${teamWorkloads.length}名`}
                icon={<UserGroupIcon />}
                title="チーム残作業"
              />
              <div className="portfolio-workload-list">
                {teamWorkloads.slice(0, 6).map((item) => (
                  <button
                    className="portfolio-workload-row"
                    key={item.member.id}
                    onClick={() =>
                      item.topProject ? onOpenProject(item.topProject.id) : undefined
                    }
                    type="button"
                  >
                    <span
                      className="portfolio-member-dot"
                      style={{ background: item.member.color }}
                    />
                    <div>
                      <strong>{item.member.name}</strong>
                      <small>
                        {Math.round(item.remainingHours)}h / {item.projectCount}案件
                        {item.delayedTaskCount > 0 ? ` / 遅延${item.delayedTaskCount}件` : ""}
                      </small>
                      <em>{item.topProject?.workspace ?? item.member.role}</em>
                      <div className="portfolio-workload-meter">
                        <span
                          style={{
                            width: `${Math.min(
                              (item.remainingHours / maxWorkloadHours) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
                {teamWorkloads.length === 0 ? (
                  <p className="portfolio-side-empty">表示できる残作業はありません。</p>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function PortfolioSummaryCard({
  detail,
  label,
  tone = "blue",
  value,
}: {
  detail: string;
  label: string;
  tone?: "blue" | "good" | "hot";
  value: string;
}) {
  return (
    <article className={`portfolio-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PanelTitle({ detail, icon, title }: { detail: string; icon: ReactNode; title: string }) {
  return (
    <div className="portfolio-panel-title">
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      <span>{detail}</span>
    </div>
  );
}
