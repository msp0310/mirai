import { expect, test } from "@playwright/test";
import {
  buildWeeklyProgressRows,
  getIssuesDueByWeek,
} from "../../frontend/src/features/analysis/components/WeeklyProgressSummary";
import { addDays, parseDate, toDateKey } from "../../frontend/src/lib/schedule";
import type { ProjectIssue, ScheduleTask } from "../../frontend/src/types/schedule";

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

test("選択週までの未解消課題を優先して抽出する", () => {
  const issues = [
    createIssue("open-high", "open", "high", "2026-01-09"),
    createIssue("resolved", "resolved", "critical", "2026-01-06"),
    createIssue("future", "open", "critical", "2026-01-20"),
  ];

  const dueIssues = getIssuesDueByWeek(issues, "2026-01-11");

  expect(dueIssues.map((issue) => issue.id)).toEqual(["open-high", "resolved"]);
});

function createIssue(
  id: string,
  status: ProjectIssue["status"],
  priority: ProjectIssue["priority"],
  dueDate: string,
): ProjectIssue {
  return {
    assigneeIds: [],
    body: "",
    createdAt: "2026-01-01T00:00:00Z",
    dueDate,
    id,
    priority,
    status,
    taskIds: [],
    title: id,
    type: "risk",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}
