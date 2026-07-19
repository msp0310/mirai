import assert from "node:assert/strict";
import test from "node:test";

import { filterTaskRows } from "../src/lib/schedule.ts";
import type { ScheduleFilters, TaskRow, TaskType } from "../src/types/schedule.ts";

const statuses: ScheduleFilters["statuses"] = {
  delayed: true,
  done: true,
  inProgress: true,
  notStarted: true,
};

test("担当者フィルターは該当行とその祖先だけを残す", () => {
  const rows = [
    row("root", null, "summary"),
    row("matched-phase", "root", "phase"),
    row("matched-task", "matched-phase", "task", ["member-a"]),
    row("other-phase", "root", "phase"),
    row("other-task", "other-phase", "task", ["member-b"]),
  ];

  assert.deepEqual(
    filterTaskRows(rows, { assigneeId: "member-a", query: "", statuses }).map(
      (task) => task.id,
    ),
    ["root", "matched-phase", "matched-task"],
  );
});

test("未割当フィルターは構造行自体を未割当として扱わない", () => {
  const rows = [
    row("root", null, "summary"),
    row("empty-phase", "root", "phase"),
    row("assigned-task", "empty-phase", "task", ["member-a"]),
    row("target-phase", "root", "phase"),
    row("unassigned-task", "target-phase", "task"),
  ];

  assert.deepEqual(
    filterTaskRows(rows, { assigneeId: "unassigned", query: "", statuses }).map(
      (task) => task.id,
    ),
    ["root", "target-phase", "unassigned-task"],
  );
});

function row(
  id: string,
  parentId: string | null,
  type: TaskType,
  assigneeIds: string[] = [],
): TaskRow {
  return {
    assigneeIds,
    color: "#2563eb",
    depth: 0,
    end: "2026-07-31",
    hasChildren: type !== "task",
    id,
    parentId,
    progress: 0,
    start: "2026-07-01",
    status: "notStarted",
    title: id,
    type,
  };
}
