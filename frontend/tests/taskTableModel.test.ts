import assert from "node:assert/strict";
import test from "node:test";

import type { Member, ScheduleTask, TaskRow } from "../src/types/schedule.ts";
import {
  buildTaskChildrenMap,
  getDescendantTaskIds,
  getReorderRootIds,
  getTaskRowReorderMode,
  sortTaskRowsPreservingHierarchy,
} from "../src/features/gantt/lib/taskTableModel.ts";
import { buildDependencyPath } from "../src/features/gantt/lib/timelineGeometry.ts";

function task(id: string, parentId: string | null): ScheduleTask {
  return { id, parentId } as ScheduleTask;
}

function row(id: string, parentId: string | null, depth: number, title: string): TaskRow {
  return {
    assigneeIds: [],
    depth,
    end: "2026-07-31",
    id,
    parentId,
    progress: 0,
    start: "2026-07-01",
    status: "notStarted",
    title,
  } as TaskRow;
}

test("階層ソートは子タスクを親の直後に保持する", () => {
  const rows = [
    row("phase-b", null, 0, "B"),
    row("task-b", "phase-b", 1, "B-1"),
    row("phase-a", null, 0, "A"),
    row("task-a", "phase-a", 1, "A-1"),
  ];

  const sorted = sortTaskRowsPreservingHierarchy(
    rows,
    { direction: "asc", key: "title" },
    [] as Member[],
  );

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["phase-a", "task-a", "phase-b", "task-b"],
  );
});

test("親子を同時選択した場合は親だけを移動ルートにする", () => {
  const tasks = [task("root", null), task("child", "root"), task("sibling", null)];
  const taskById = new Map(tasks.map((item) => [item.id, item]));

  assert.deepEqual(getReorderRootIds(tasks, ["root", "child"], taskById), ["root"]);
});

test("子孫探索はすべての深さを収集する", () => {
  const tasks = [
    task("root", null),
    task("child", "root"),
    task("grandchild", "child"),
    task("other", null),
  ];

  assert.deepEqual(
    [...getDescendantTaskIds("root", buildTaskChildrenMap(tasks))].sort(),
    ["child", "grandchild"],
  );
});

test("横方向の移動量から階層操作を判定する", () => {
  assert.equal(getTaskRowReorderMode(140, 100), "child");
  assert.equal(getTaskRowReorderMode(60, 100), "outdent");
  assert.equal(getTaskRowReorderMode(120, 100), "sibling");
});

test("依存線は逆行するタスクでも折れ線として接続する", () => {
  assert.equal(buildDependencyPath(100, 20, 60, 60), "M 100 20 H 116 V 60 H 60");
});
