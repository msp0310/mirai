import { expect, test } from "@playwright/test";

import { filterTaskRows, flattenTasks } from "../../frontend/src/lib/schedule";
import type { ScheduleFilters, ScheduleTask } from "../../frontend/src/types/schedule";

/** 10万段の深い階層を作り、階層表示の上限耐性を検証します。 */
function createDeepTasks(count: number): ScheduleTask[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `deep-task-${index}`,
    parentId: index === 0 ? null : `deep-task-${index - 1}`,
    title: `深い階層タスク ${index}`,
    type: "task" as const,
    status: "notStarted" as const,
    start: "2026-01-05",
    end: "2026-01-06",
    progress: 0,
    assigneeIds: index === count - 1 ? ["target-member"] : [],
    color: "#89b7ff",
  }));
}

test("10万段のタスク階層を安全に平坦化し、担当者で絞り込める", () => {
  const tasks = createDeepTasks(100_000);
  const startedAt = performance.now();
  const rows = flattenTasks(tasks);
  const filters: ScheduleFilters = {
    query: "",
    assigneeId: "target-member",
    statuses: { notStarted: true, inProgress: true, done: true, delayed: true },
  };
  const matchedRows = filterTaskRows(rows, filters);
  const elapsedMs = performance.now() - startedAt;

  expect(rows).toHaveLength(100_000);
  expect(matchedRows).toHaveLength(1);
  expect(elapsedMs, `階層展開と絞り込みが${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1000);
});
