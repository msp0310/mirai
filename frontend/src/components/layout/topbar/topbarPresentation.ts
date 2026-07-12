import type { Project, Team } from "../../../types/schedule";
import type { TopbarContextMode } from "./types";

export function getTopbarContextPresentation(contextMode: TopbarContextMode, project: Project) {
  const pageTitles: Record<TopbarContextMode, string> = {
    admin: "管理設定",
    dailyReports: "日報",
    help: "ヘルプ",
    personalAnalytics: "個人分析",
    portfolio: "プロジェクトポートフォリオ",
    project: project.workspace,
    workload: "チーム分析・要員計画",
  };
  const contextLabels: Record<TopbarContextMode, string> = {
    admin: "管理設定",
    dailyReports: "日報",
    help: "ヘルプ",
    personalAnalytics: "個人分析",
    portfolio: "案件一覧",
    project: "案件一覧",
    workload: "チーム分析",
  };
  return {
    contextLabel: contextLabels[contextMode],
    pageTitle: pageTitles[contextMode],
    projectContext: contextMode === "project",
    projectSearchAvailable: contextMode !== "admin" && contextMode !== "help",
    syncActionsVisible:
      contextMode !== "dailyReports" &&
      contextMode !== "personalAnalytics" &&
      contextMode !== "help",
  };
}

export function filterAndOrderProjects(
  projects: Project[],
  teams: Team[],
  favoriteProjectIds: Set<string>,
  query: string,
) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = projects.filter((project) => {
    if (!normalizedQuery) {
      return true;
    }
    const team = project.teamId ? teamById.get(project.teamId) : undefined;
    return [
      project.workspace,
      project.name,
      project.projectNo ?? "",
      project.id,
      team?.name ?? "",
      team?.code ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const active = filtered.filter((project) => project.status !== "archived");
  return [
    ...active.filter((project) => favoriteProjectIds.has(project.id)),
    ...active.filter((project) => !favoriteProjectIds.has(project.id)),
    ...filtered.filter((project) => project.status === "archived"),
  ];
}

export function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "保存日時不明";
  }
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
