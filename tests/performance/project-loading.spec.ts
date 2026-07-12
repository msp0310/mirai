import { expect, test } from "@playwright/test";

import { findMissingProjectIds, selectInitialProject } from "../../frontend/src/app/projectLoading";
import type {
  ProjectSummary,
  ScheduleSnapshot,
  ScheduleWorkspaceSummary,
} from "../../frontend/src/data/scheduleRepository";

/** 大量案件の一覧状態を固定形状で生成します。 */
function createSummaries(count: number): ProjectSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    completedTaskCount: index % 10,
    delayedTaskCount: index % 7 === 0 ? 1 : 0,
    memberCount: 3,
    progress: index % 100,
    project: {
      id: `project-${index}`,
      lifecycleStatus: "inProgress" as const,
      memberIds: [],
      name: `案件${index}`,
      nextMilestone: { date: "2026-06-30", title: "節目" },
      rangeEnd: "2026-12-31",
      rangeStart: "2026-01-01",
      status: "active" as const,
      teamId: index % 2 === 0 ? "team-a" : "team-b",
      workspace: `案件${index}`,
    },
    taskCount: 100,
  }));
}

test("10万案件の初期選択と未取得案件抽出を1秒以内に完了する", () => {
  const projects = createSummaries(100_000);
  const summary: ScheduleWorkspaceSummary = {
    projects,
    teams: [],
  };
  const loadedSchedules = projects.slice(0, 50).map((item) => ({
    calendar: { id: "calendar", name: "標準", holidays: [], workWeek: [1, 2, 3, 4, 5] },
    members: [],
    project: item.project,
    tasks: [],
  })) satisfies ScheduleSnapshot[];

  const startedAt = performance.now();
  const selected = selectInitialProject(summary, { draftProjectId: "project-99999" });
  const missing = findMissingProjectIds(projects, loadedSchedules, "team-a");
  const elapsedMs = performance.now() - startedAt;

  expect(selected?.id).toBe("project-99999");
  expect(missing.length).toBeGreaterThan(0);
  expect(elapsedMs, `案件一覧の選択処理が${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1000);
});
