import assert from "node:assert/strict";
import test from "node:test";

import { buildCalendarDateStrip } from "../src/features/calendar/model/calendarView.ts";
import type { CalendarDefinition, ScheduleTask } from "../src/types/schedule.ts";

const calendar: CalendarDefinition = {
  holidays: [],
  id: "calendar",
  name: "標準",
  workWeek: [1, 2, 3, 4, 5],
};

test("選択日前後7日の日付と予定件数を表示する", () => {
  const items = buildCalendarDateStrip("2026-07-20", [task()], calendar);

  assert.equal(items.length, 7);
  assert.equal(items[0]?.dateKey, "2026-07-17");
  assert.equal(items[3]?.selected, true);
  assert.equal(items[3]?.eventCount, 1);
  assert.equal(items[6]?.dateKey, "2026-07-23");
});

function task(): ScheduleTask {
  return {
    assigneeIds: [],
    color: "#2864ea",
    end: "2026-07-20",
    id: "task",
    parentId: null,
    progress: 0,
    start: "2026-07-20",
    status: "notStarted",
    title: "設計レビュー",
    type: "task",
  };
}
