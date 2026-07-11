import { expect, test } from "@playwright/test";
import { buildWeeklyProgressRows } from "../../frontend/src/features/analysis/components/WeeklyProgressSummary";
import { addDays, parseDate, toDateKey } from "../../frontend/src/lib/schedule";
import type { ScheduleTask } from "../../frontend/src/types/schedule";

function createTasks(count: number): ScheduleTask[] {
  const projectStart = parseDate("2026-01-05");
  return Array.from({ length: count }, (_, index) => {
    const start = toDateKey(addDays(projectStart, (index % 52) * 7));
    const end = toDateKey(addDays(parseDate(start), index % 5));
    const done = index % 5 === 0;
    const delayed = !done && index % 17 === 0;
    return {
      assigneeIds: [],
      color: "#2864ea",
      end,
      id: `weekly-task-${index}`,
      parentId: null,
      progress: done ? 100 : delayed ? 35 : 50,
      start,
      status: done ? "done" : delayed ? "delayed" : "inProgress",
      title: `週次確認タスク ${index}`,
      type: "task",
    };
  });
}

test("10,000タスクの週次進捗集計を1秒以内に完了する", () => {
  const tasks = createTasks(10_000);
  const startedAt = performance.now();
  const rows = buildWeeklyProgressRows(tasks, "2026-01-01", "2026-12-31");
  const elapsedMs = performance.now() - startedAt;

  expect(rows.length).toBeGreaterThanOrEqual(52);
  expect(rows.reduce((sum, row) => sum + row.planned, 0)).toBe(tasks.length);
  expect(rows.some((row) => row.delayed > 0)).toBe(true);
  expect(elapsedMs, `週次進捗集計が${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1_000);
});
