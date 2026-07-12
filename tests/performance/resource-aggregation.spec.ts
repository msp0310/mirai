import { expect, test } from "@playwright/test";

import type { ScheduleSnapshot } from "../../frontend/src/data/scheduleRepository";
import { buildCrossProjectResourceRows } from "../../frontend/src/lib/resourceCalculations";
import type {
  CalendarDefinition,
  Member,
  ScheduleTask,
  TimelineColumn,
} from "../../frontend/src/types/schedule";

const calendar: CalendarDefinition = {
  id: "performance-calendar",
  name: "性能テスト用カレンダー",
  workWeek: [1, 2, 3, 4, 5],
  holidays: [],
};

/** 大量データを固定形状で生成し、性能回帰を再現可能にします。 */
function createPerformanceData(): {
  members: Member[];
  schedules: ScheduleSnapshot[];
  weeks: TimelineColumn[];
} {
  const members = Array.from({ length: 30 }, (_, index) => ({
    id: `member-${index}`,
    name: `性能テストメンバー${index}`,
    initials: `M${index}`,
    role: "SE",
    color: "#2f80ed",
    capacityHours: 40,
    status: "active" as const,
  }));
  const weeks = Array.from({ length: 52 }, (_, index) => ({
    key: `2026-W${String(index + 1).padStart(2, "0")}`,
    label: `W${index + 1}`,
    start: new Date(Date.UTC(2026, 0, 5 + index * 7)).toISOString().slice(0, 10),
    startIndex: index * 5,
    span: 5,
  }));
  const schedules = Array.from({ length: 10 }, (_projectValue, projectIndex) => {
    const tasks: ScheduleTask[] = Array.from({ length: 300 }, (_taskValue, taskIndex) => ({
      id: `project-${projectIndex}-task-${taskIndex}`,
      parentId: null,
      title: `性能測定タスク ${projectIndex}-${taskIndex}`,
      type: "task",
      status: "inProgress",
      start: "2026-01-05",
      end: "2026-03-27",
      progress: taskIndex % 100,
      assigneeIds: [`member-${taskIndex % members.length}`],
      color: "#89b7ff",
      effortHours: 8,
    }));
    return {
      calendar,
      members,
      project: {
        id: `project-${projectIndex}`,
        teamId: "performance-team",
        name: `性能測定案件${projectIndex}`,
        workspace: `性能測定案件${projectIndex}`,
        memberIds: members.map((member) => member.id),
        rangeStart: "2026-01-01",
        rangeEnd: "2026-12-31",
        nextMilestone: { title: "性能測定", date: "2026-06-30" },
        status: "active" as const,
        lifecycleStatus: "inProgress" as const,
      },
      tasks,
    };
  });
  return { members, schedules, weeks };
}

test("30人・10案件・3,000タスクのResource集計を1秒以内に完了する", () => {
  const { members, schedules, weeks } = createPerformanceData();
  const startedAt = performance.now();
  const rows = buildCrossProjectResourceRows({
    baseCalendar: calendar,
    calendarAware: true,
    members,
    schedules,
    weeks,
  });
  const elapsedMs = performance.now() - startedAt;

  expect(rows).toHaveLength(30);
  expect(rows.every((row) => row.cells.length === 52)).toBe(true);
  expect(elapsedMs, `Resource集計が${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1000);
});
