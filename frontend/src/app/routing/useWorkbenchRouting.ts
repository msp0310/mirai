import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { ViewTab } from "../../components/layout/ViewTabs";
import { getCompassRouteState } from "./compassRouteState";

type NavigateOptions = { replace?: boolean };

/** URLとワークベンチ内の画面遷移を相互変換します。 */
export function useWorkbenchRouting(activeProjectId: string) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const routeState = useMemo(() => getCompassRouteState(pathname), [pathname]);

  const navigateToProjectView = useCallback(
    (projectId: string, tab: ViewTab = "Gantt", options: NavigateOptions = {}) => {
      const routeOptions = { params: { projectId }, replace: options.replace };
      switch (tab) {
        case "Status": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/overview" });
        }
        case "WeeklyReport": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/weekly-report" });
        }
        case "Analysis": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/analysis" });
        }
        case "Issues": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/issues" });
        }
        case "WorkLogs": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/work-logs" });
        }
        case "Resource": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/resources" });
        }
        case "Calendar": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/calendar" });
        }
        case "Milestones": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/milestones" });
        }
        case "Activity": {
          return navigate({ ...routeOptions, to: "/projects/$projectId/history" });
        }
        default: {
          return navigate({ ...routeOptions, to: "/projects/$projectId/gantt" });
        }
      }
    },
    [navigate],
  );

  const setActiveTab = useCallback(
    (tab: ViewTab) => {
      if (tab === "Projects") {
        return navigate({ to: "/projects" });
      }
      if (tab === "DailyReports") {
        return navigate({ to: "/daily-reports" });
      }
      if (tab === "PersonalAnalytics") {
        return navigate({ to: "/analytics/personal" });
      }
      if (tab === "Workload") {
        return navigate({ to: "/analytics/team" });
      }
      return navigateToProjectView(activeProjectId, tab);
    },
    [activeProjectId, navigate, navigateToProjectView],
  );

  return {
    activeTab: routeState.activeTab,
    navigateToHelp: () => navigate({ to: "/help" }),
    navigateToManagementSettings: () => navigate({ to: "/admin" }),
    navigateToProjectSettings: (projectId = activeProjectId) =>
      navigate({ params: { projectId }, to: "/projects/$projectId/settings" }),
    navigateToProjectView,
    routeProjectId: routeState.projectId,
    setActiveTab,
    showHelpPage: routeState.page === "help",
    showMasterSettings: routeState.page === "managementSettings",
    showProjectSettings: routeState.page === "projectSettings",
  };
}
