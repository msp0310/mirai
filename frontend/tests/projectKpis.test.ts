import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectKpis } from "../src/features/analysis/model/projectKpis.ts";
import type {
  CalendarDefinition,
  ProjectWorkLog,
  ScheduleChangeLog,
  ScheduleTask,
} from "../src/types/schedule.ts";

const calendar: CalendarDefinition = {
  holidays: [],
  id: "calendar",
  name: "標準",
  workWeek: [1, 2, 3, 4, 5],
};

test("納期遵守率は基準終了日と実績完了日を比較する", () => {
  const kpis = buildProjectKpis({
    asOfDate: "2026-07-20",
    calendar,
    calendarAware: false,
    changeLogs: [completionLog("legacy-milestone", "2026-07-12T09:00:00.000Z")],
    tasks: [
      task("on-time", {
        actualEnd: "2026-07-09",
        baselineEnd: "2026-07-10",
        end: "2026-07-12",
        status: "done",
      }),
      task("late", {
        actualEnd: "2026-07-11",
        baselineEnd: "2026-07-10",
        status: "done",
      }),
      task("legacy-milestone", {
        end: "2026-07-12",
        start: "2026-07-12",
        status: "done",
        type: "milestone",
      }),
      task("open", { status: "inProgress" }),
    ],
    workLogs: [],
  });

  assert.deepEqual(kpis.delivery, {
    completedCount: 3,
    evaluatedCount: 3,
    missingCompletionCount: 0,
    onTimeCount: 2,
    rate: 67,
  });
});

test("工数予実差と進捗達成率は基準日時点の計画と実績を比較する", () => {
  const kpis = buildProjectKpis({
    asOfDate: "2026-07-05",
    calendar,
    calendarAware: false,
    changeLogs: [],
    tasks: [
      task("current", {
        effortHours: 80,
        end: "2026-07-10",
        progress: 50,
        start: "2026-07-01",
      }),
      task("future", {
        effortHours: 80,
        end: "2026-07-20",
        start: "2026-07-11",
      }),
    ],
    workLogs: [workLog("2026-07-05", 45), workLog("2026-07-06", 100)],
  });

  assert.deepEqual(kpis.effort, {
    actualHours: 45,
    hasActual: true,
    plannedHoursToDate: 40,
    totalPlannedHours: 160,
    varianceHours: 5,
    varianceRate: 13,
  });
  assert.deepEqual(kpis.progress, {
    achievementRate: 100,
    actualRate: 25,
    gapPoints: 0,
    plannedRate: 25,
  });
});

test("作業時間が未入力の場合は工数予実差を未評価にする", () => {
  const kpis = buildProjectKpis({
    asOfDate: "2026-07-10",
    calendar,
    calendarAware: false,
    changeLogs: [],
    tasks: [task("task", { effortHours: 40, progress: 50 })],
    workLogs: [],
  });

  assert.equal(kpis.effort.hasActual, false);
  assert.equal(kpis.effort.varianceHours, null);
  assert.equal(kpis.effort.varianceRate, null);
});

function task(id: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    assigneeIds: [],
    color: "#89b7ff",
    end: "2026-07-10",
    id,
    parentId: null,
    progress: 0,
    start: "2026-07-01",
    status: "notStarted",
    title: id,
    type: "task",
    ...overrides,
  };
}

function workLog(date: string, hours: number): ProjectWorkLog {
  return {
    billable: true,
    category: "other",
    createdAt: `${date}T00:00:00.000Z`,
    createdBy: "tester",
    date,
    hours,
    id: `log-${date}-${hours}`,
    memberId: "member",
    summary: "作業",
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function completionLog(taskId: string, changedAt: string): ScheduleChangeLog {
  return {
    afterValue: "done",
    beforeValue: "inProgress",
    changedAt,
    changedBy: "tester",
    field: "status",
    id: `change-${taskId}`,
    projectId: "project",
    taskId,
  };
}
