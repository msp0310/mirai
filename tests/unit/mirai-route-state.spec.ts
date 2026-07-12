import { expect, test } from "@playwright/test";

import {
  getMiraiRouteState,
  getProjectViewSegment,
} from "../../frontend/src/app/routing/miraiRouteState";

test("案件ルートから案件IDと表示タブを復元する", () => {
  expect(getMiraiRouteState("/projects/site-renewal/gantt")).toEqual({
    activeTab: "Gantt",
    page: "view",
    projectId: "site-renewal",
  });
  expect(getMiraiRouteState("/projects/cloud%20migration/settings")).toEqual({
    activeTab: "Gantt",
    page: "projectSettings",
    projectId: "cloud migration",
  });
});

test("全体画面と案件内タブをURLへ対応付ける", () => {
  expect(getMiraiRouteState("/projects").activeTab).toBe("Projects");
  expect(getMiraiRouteState("/daily-reports").activeTab).toBe("DailyReports");
  expect(getMiraiRouteState("/analytics/personal").activeTab).toBe("PersonalAnalytics");
  expect(getMiraiRouteState("/analytics/team").activeTab).toBe("Workload");
  expect(getProjectViewSegment("WeeklyReport")).toBe("weekly-report");
  expect(getProjectViewSegment("Activity")).toBe("history");
});
