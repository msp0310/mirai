import type { ScheduleSnapshot, ScheduleWorkspace } from "../data/scheduleRepository";

/** 取得済み案件を重複なくワークスペースへ追加または置換します。 */
export function mergeScheduleIntoWorkspace(
  workspace: ScheduleWorkspace,
  schedule: ScheduleSnapshot,
): ScheduleWorkspace {
  const exists = workspace.schedules.some((item) => item.project.id === schedule.project.id);
  return {
    ...workspace,
    schedules: exists
      ? workspace.schedules.map((item) =>
          item.project.id === schedule.project.id ? schedule : item,
        )
      : [...workspace.schedules, schedule],
  };
}
