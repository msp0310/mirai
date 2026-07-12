import { useMemo } from "react";

import type { TopbarNotification } from "../components/layout/Topbar";
import { formatShortDate } from "../lib/schedule";
import type { ScheduleHealthReport } from "../lib/scheduleHealth";
import type { DailyReportReminder, ResourceRowModel, ScheduleTask } from "../types/schedule";

type UseWorkbenchNotificationsOptions = {
  dailyReportReminders: DailyReportReminder[];
  healthReport: ScheduleHealthReport;
  resourceRows: ResourceRowModel[];
  tasks: ScheduleTask[];
};

/** 案件状態と日報リマインドからトップバー通知を組み立てます。 */
export function useWorkbenchNotifications({
  dailyReportReminders,
  healthReport,
  resourceRows,
  tasks,
}: UseWorkbenchNotificationsOptions) {
  return useMemo<TopbarNotification[]>(() => {
    const delayedTasks = tasks.filter((task) => task.type === "task" && task.status === "delayed");
    const [nextMilestone] = tasks
      .filter((task) => task.type === "milestone" && task.status !== "done")
      .toSorted((a, b) => a.start.localeCompare(b.start));
    const overloadedRows = resourceRows.filter((row) => row.utilization >= 90);
    return [
      delayedTasks.length > 0
        ? {
            detail: `${delayedTasks[0].title}${
              delayedTasks.length > 1 ? ` ほか${delayedTasks.length - 1}件` : ""
            }`,
            id: "delayed-tasks",
            title: `遅延タスクが${delayedTasks.length}件あります`,
            tone: "danger" as const,
          }
        : null,
      nextMilestone
        ? {
            detail: `${formatShortDate(nextMilestone.start)} ${nextMilestone.title}`,
            id: "next-milestone",
            title: "次のマイルストーン",
            tone: "info" as const,
          }
        : null,
      overloadedRows.length > 0
        ? {
            detail: `${overloadedRows[0].member.name} ${overloadedRows[0].utilization}%`,
            id: "resource-overload",
            title: "高負荷メンバーを確認してください",
            tone: "warning" as const,
          }
        : null,
      healthReport.dangerCount > 0
        ? {
            detail: healthReport.issues[0]?.title ?? "データ整合性を確認してください",
            id: "schedule-health",
            title: `健全性エラーが${healthReport.dangerCount}件あります`,
            tone: "danger" as const,
          }
        : healthReport.warningCount > 0
          ? {
              detail: healthReport.issues[0]?.title ?? "データ整合性を確認してください",
              id: "schedule-health",
              title: `健全性の確認事項が${healthReport.warningCount}件あります`,
              tone: "warning" as const,
            }
          : null,
      ...dailyReportReminders.map((reminder) => ({
        detail: `${reminder.date} / ${reminder.senderName}から届きました`,
        id: reminder.id,
        title: "日報の提出をお願いします",
        tone: "warning" as const,
      })),
    ].filter((notification): notification is TopbarNotification => Boolean(notification));
  }, [dailyReportReminders, healthReport, resourceRows, tasks]);
}
