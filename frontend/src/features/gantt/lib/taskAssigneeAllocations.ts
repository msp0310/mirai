import { getTaskAssigneeAllocationMap } from "../../../lib/schedule";
import type { ScheduleTask } from "../../../types/schedule";

/** 担当者を追加したとき、合計100%になるよう均等配分します。 */
export function buildEqualAssigneeAllocations(assigneeIds: string[]) {
  const ids = [...new Set(assigneeIds)];
  if (ids.length <= 1) {
    return undefined;
  }
  const base = Math.floor(100 / ids.length);
  const remainder = 100 - base * ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    percent: base + (index === ids.length - 1 ? remainder : 0),
  }));
}

export function buildAdjustedAssigneeAllocations(
  task: ScheduleTask,
  memberId: string,
  percent: number,
) {
  const ids = [...new Set(task.assigneeIds)];
  if (ids.length <= 1) {
    return undefined;
  }
  const clamped = Math.min(Math.max(Math.round(percent), 0), 100);
  const currentMap = getTaskAssigneeAllocationMap(task);
  const otherIds = ids.filter((id) => id !== memberId);
  const otherTotal = otherIds.reduce((sum, id) => sum + (currentMap.get(id) ?? 0), 0);
  const remaining = 100 - clamped;
  const rawAllocations = ids.map((id) => {
    if (id === memberId) {
      return { memberId: id, percent: clamped };
    }
    const currentPercent = currentMap.get(id) ?? 0;
    return {
      memberId: id,
      percent:
        otherTotal > 0 ? (currentPercent / otherTotal) * remaining : remaining / otherIds.length,
    };
  });
  return roundAllocationsTo100(rawAllocations);
}

function roundAllocationsTo100(allocations: { memberId: string; percent: number }[]) {
  const rounded = allocations.map((allocation) => {
    const floored = Math.floor(allocation.percent);
    return {
      fractional: allocation.percent - floored,
      memberId: allocation.memberId,
      percent: floored,
    };
  });
  let remainder = 100 - rounded.reduce((sum, allocation) => sum + allocation.percent, 0);
  [...rounded]
    .toSorted((a, b) => b.fractional - a.fractional)
    .forEach((allocation) => {
      if (remainder <= 0) {
        return;
      }
      allocation.percent += 1;
      remainder -= 1;
    });
  return rounded.map(({ memberId, percent }) => ({ memberId, percent }));
}
