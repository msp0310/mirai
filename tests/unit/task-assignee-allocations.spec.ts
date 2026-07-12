import { expect, test } from "@playwright/test";

import {
  buildAdjustedAssigneeAllocations,
  buildEqualAssigneeAllocations,
} from "../../frontend/src/features/gantt/lib/taskAssigneeAllocations";
import type { ScheduleTask } from "../../frontend/src/types/schedule";

test("担当者を均等配分して合計100%にする", () => {
  const allocations = buildEqualAssigneeAllocations(["member-a", "member-b", "member-c"]);

  expect(allocations).toHaveLength(3);
  expect(allocations?.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
});

test("一人の配分変更後も他担当者を再配分して合計100%を保つ", () => {
  const task = {
    assigneeAllocations: [
      { memberId: "member-a", percent: 50 },
      { memberId: "member-b", percent: 30 },
      { memberId: "member-c", percent: 20 },
    ],
    assigneeIds: ["member-a", "member-b", "member-c"],
  } as ScheduleTask;

  const allocations = buildAdjustedAssigneeAllocations(task, "member-a", 70);

  expect(allocations?.find((item) => item.memberId === "member-a")?.percent).toBe(70);
  expect(allocations?.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
});
