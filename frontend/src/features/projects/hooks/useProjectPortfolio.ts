import { useMemo, useState } from "react";

import type { ProjectSummary, ScheduleSnapshot } from "../../../data/scheduleRepository";
import { projectLifecycleOptions } from "../../../lib/projects";
import type { ProjectLifecycleStatus, Team } from "../../../types/schedule";
import {
  buildPortfolioItem,
  buildPortfolioSummaryItem,
  buildTeamWorkloads,
  comparePortfolioItems,
  isAttentionProject,
  matchesPortfolioFilter,
  matchesPortfolioQuery,
  type PortfolioFilter,
  type PortfolioSort,
} from "../projectPortfolioModel";

type UseProjectPortfolioOptions = {
  activeTeamId: string;
  calendarAware: boolean;
  favoriteProjectIds: Set<string>;
  projectSummaries: ProjectSummary[];
  schedules: ScheduleSnapshot[];
  teams: Team[];
};

/** 案件一覧の検索・集計・右側サマリーで共有するView Modelを構築します。 */
export function useProjectPortfolio({
  activeTeamId,
  calendarAware,
  favoriteProjectIds,
  projectSummaries,
  schedules,
  teams,
}: UseProjectPortfolioOptions) {
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
      calendarAware,
      favoriteProjectIds,
      normalizedTeamId,
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
        .sort((left, right) => comparePortfolioItems(left, right, sort)),
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
    .map((item) => ({ milestone: item.nextMilestone, project: item.project }))
    .toSorted((left, right) => left.milestone.start.localeCompare(right.milestone.start))
    .slice(0, 5);
  const attentionItems = allItems
    .filter(isAttentionProject)
    .toSorted((left, right) => comparePortfolioItems(left, right, "priority"))
    .slice(0, 5);
  const teamWorkloads = useMemo(
    () =>
      teamDetailsComplete
        ? buildTeamWorkloads({ calendarAware, schedules: teamSchedules, team })
        : [],
    [calendarAware, team, teamDetailsComplete, teamSchedules],
  );
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

  return {
    allItems,
    attentionItems,
    attentionProjectCount,
    averageProgress,
    clearFilters: () => {
      setFilter("all");
      setQuery("");
    },
    completedTasks,
    filter,
    filteredItems,
    hasActiveFilter: filter !== "all" || normalizedQuery.length > 0,
    lifecycleCounts,
    maxWorkloadHours: Math.max(...teamWorkloads.map((item) => item.remainingHours), 1),
    nextMilestones,
    query,
    setFilter,
    setQuery,
    setSort,
    sort,
    team,
    teamCards,
    teamDetailsComplete,
    teamWorkloads,
    totalTasks,
  };
}
