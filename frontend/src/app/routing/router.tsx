import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { App } from "../../App";
import { queryClient } from "../query/queryClient";

/** 認証・ワークスペースを維持したまま、子ルートの変更だけを反映します。 */
function AppRouteRoot() {
  return (
    <>
      <App />
      <Outlet />
    </>
  );
}

function EmptyRoute() {
  return null;
}

function NestedRoute() {
  return <Outlet />;
}

type MiraiRouterContext = {
  queryClient: QueryClient;
};

const rootRoute = createRootRouteWithContext<MiraiRouterContext>()({ component: AppRouteRoot });
const indexRoute = createRoute({
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
  getParentRoute: () => rootRoute,
  path: "/",
});
const projectsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/projects",
});
const projectRoute = createRoute({
  component: NestedRoute,
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const projectGanttRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "gantt",
});
const projectOverviewRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "overview",
});
const projectWeeklyReportRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "weekly-report",
});
const projectAnalysisRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "analysis",
});
const projectIssuesRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "issues",
});
const projectWorkLogsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "work-logs",
});
const projectResourcesRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "resources",
});
const projectCalendarRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "calendar",
});
const projectMilestonesRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "milestones",
});
const projectHistoryRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "history",
});
const projectSettingsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => projectRoute,
  path: "settings",
});
const dailyReportsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/daily-reports",
});
const personalAnalyticsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/analytics/personal",
});
const teamAnalyticsRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/analytics/team",
});
const adminRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/admin",
});
const helpRoute = createRoute({
  component: EmptyRoute,
  getParentRoute: () => rootRoute,
  path: "/help",
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  projectRoute.addChildren([
    projectGanttRoute,
    projectOverviewRoute,
    projectWeeklyReportRoute,
    projectAnalysisRoute,
    projectIssuesRoute,
    projectWorkLogsRoute,
    projectResourcesRoute,
    projectCalendarRoute,
    projectMilestonesRoute,
    projectHistoryRoute,
    projectSettingsRoute,
  ]),
  dailyReportsRoute,
  personalAnalyticsRoute,
  teamAnalyticsRoute,
  adminRoute,
  helpRoute,
]);

export const router = createRouter({
  context: { queryClient },
  defaultPreload: "intent",
  // Query側で鮮度と重複排除を管理するため、Routerはloaderを毎回Queryへ委譲できます。
  defaultPreloadStaleTime: 0,
  routeTree,
  Wrap: ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
