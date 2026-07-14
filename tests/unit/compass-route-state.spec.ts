import { expect, test } from "@playwright/test";

import {
  getCompassRouteState,
  getProjectViewSegment,
} from "../../frontend/src/app/routing/compassRouteState";

test("案件ルートから案件IDと表示タブを復元する", () => {
  expect(getCompassRouteState("/projects/site-renewal/gantt")).toEqual({
    activeTab: "Gantt",
    page: "view",
    projectId: "site-renewal",
  });
  expect(getCompassRouteState("/projects/cloud%20migration/settings")).toEqual({
    activeTab: "Gantt",
    page: "projectSettings",
    projectId: "cloud migration",
  });
});

test("全体画面と案件内タブをURLへ対応付ける", () => {
  expect(getCompassRouteState("/projects").activeTab).toBe("Projects");
  expect(getCompassRouteState("/daily-reports").activeTab).toBe("DailyReports");
  expect(getCompassRouteState("/analytics/personal").activeTab).toBe("PersonalAnalytics");
  expect(getCompassRouteState("/analytics/team").activeTab).toBe("Workload");
  expect(getProjectViewSegment("WeeklyReport")).toBe("weekly-report");
  expect(getProjectViewSegment("Activity")).toBe("history");
});
