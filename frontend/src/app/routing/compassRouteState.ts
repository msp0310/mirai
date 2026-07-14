import type { ViewTab } from "../../components/layout/ViewTabs";

export type CompassRoutePage = "help" | "managementSettings" | "projectSettings" | "view";

export type CompassRouteState = {
  activeTab: ViewTab;
  page: CompassRoutePage;
  projectId: string | null;
};

const projectSegmentByTab = {
  Activity: "history",
  Analysis: "analysis",
  Calendar: "calendar",
  Gantt: "gantt",
  Issues: "issues",
  Milestones: "milestones",
  Resource: "resources",
  Status: "overview",
  WeeklyReport: "weekly-report",
  WorkLogs: "work-logs",
} as const satisfies Partial<Record<ViewTab, string>>;

const projectTabBySegment = Object.fromEntries(
  Object.entries(projectSegmentByTab).map(([tab, segment]) => [segment, tab]),
) as Record<string, ViewTab>;

/** 現在のパスから、COMPASSで表示する画面と案件を導出します。 */
export function getCompassRouteState(pathname: string): CompassRouteState {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "projects" && segments[1]) {
    const projectId = decodePathSegment(segments[1]);
    if (segments[2] === "settings") {
      return { activeTab: "Gantt", page: "projectSettings", projectId };
    }
    return {
      activeTab: projectTabBySegment[segments[2] ?? "gantt"] ?? "Gantt",
      page: "view",
      projectId,
    };
  }
  if (segments[0] === "daily-reports") {
    return { activeTab: "DailyReports", page: "view", projectId: null };
  }
  if (segments[0] === "analytics" && segments[1] === "personal") {
    return { activeTab: "PersonalAnalytics", page: "view", projectId: null };
  }
  if (segments[0] === "analytics" && segments[1] === "team") {
    return { activeTab: "Workload", page: "view", projectId: null };
  }
  if (segments[0] === "admin") {
    return { activeTab: "Projects", page: "managementSettings", projectId: null };
  }
  if (segments[0] === "help") {
    return { activeTab: "Projects", page: "help", projectId: null };
  }
  return { activeTab: "Projects", page: "view", projectId: null };
}

/** 案件内タブをURLセグメントへ変換します。 */
export function getProjectViewSegment(tab: ViewTab) {
  return projectSegmentByTab[tab as keyof typeof projectSegmentByTab] ?? "gantt";
}

/** 初期API読込で優先する案件IDを現在URLから取得します。 */
export function getProjectIdFromCurrentRoute() {
  if (typeof window === "undefined") {
    return null;
  }
  return getCompassRouteState(window.location.pathname).projectId;
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
