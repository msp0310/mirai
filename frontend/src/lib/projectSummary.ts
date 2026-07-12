import type { ProjectSummary, ScheduleSnapshot } from "../data/scheduleRepository";
import { getProgressStats } from "./schedule";

/** 詳細スナップショットから案件一覧用の軽量集計を作成します。 */
export function createProjectSummaryFromSnapshot(snapshot: ScheduleSnapshot): ProjectSummary {
  const stats = getProgressStats(snapshot.tasks);
  return {
    completedTaskCount: stats.completed,
    delayedTaskCount: snapshot.tasks.filter(
      (task) => task.type === "task" && task.status === "delayed",
    ).length,
    memberCount: snapshot.project.memberIds?.length ?? snapshot.members.length,
    progress: stats.progress,
    project: snapshot.project,
    taskCount: stats.total,
  };
}
