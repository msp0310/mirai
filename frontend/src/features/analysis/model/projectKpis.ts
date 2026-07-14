import { daysInclusive, getWorkingDays } from "../../../lib/schedule.ts";
import type {
  CalendarDefinition,
  ProjectWorkLog,
  ScheduleChangeLog,
  ScheduleTask,
} from "../../../types/schedule";

export const projectKpiTargets = {
  effortVarianceRate: 10,
  onTimeDeliveryRate: 90,
  progressAchievementRate: 95,
} as const;

export type ProjectKpiModel = {
  delivery: {
    completedCount: number;
    evaluatedCount: number;
    missingCompletionCount: number;
    onTimeCount: number;
    rate: number | null;
  };
  effort: {
    actualHours: number;
    hasActual: boolean;
    plannedHoursToDate: number;
    totalPlannedHours: number;
    varianceHours: number | null;
    varianceRate: number | null;
  };
  progress: {
    achievementRate: number | null;
    actualRate: number;
    gapPoints: number;
    plannedRate: number;
  };
};

type BuildProjectKpisInput = {
  asOfDate: string;
  calendar: CalendarDefinition;
  calendarAware: boolean;
  changeLogs: ScheduleChangeLog[];
  tasks: ScheduleTask[];
  workLogs: ProjectWorkLog[];
};

/** 案件KPIを、基準計画・実績日・予定工数・作業時間から同じ基準日で集計します。 */
export function buildProjectKpis({
  asOfDate,
  calendar,
  calendarAware,
  changeLogs = [],
  tasks,
  workLogs,
}: BuildProjectKpisInput): ProjectKpiModel {
  const deliveryTargets = tasks.filter(
    (task) => (task.type === "task" || task.type === "milestone") && task.status === "done",
  );
  const completionDateByTaskId = getCompletionDateByTaskId(changeLogs);
  const deliveryResults = deliveryTargets
    .map((task) => ({
      actualEnd: task.actualEnd ?? completionDateByTaskId.get(task.id),
      dueDate: task.baselineEnd ?? task.end,
    }))
    .filter((result): result is { actualEnd: string; dueDate: string } => result.actualEnd != null);
  const actionableTasks = tasks.filter((task) => task.type === "task");
  const effortRows = actionableTasks.map((task) => {
    const { end, start } = getPlanRange(task);
    const effortHours =
      task.effortHours ?? getWorkingDays(start, end, calendar, calendarAware) * 8;
    const plannedProgress = getPlannedProgress(task, asOfDate, calendar, calendarAware);
    return {
      actualProgress: clampPercent(task.progress),
      effortHours,
      plannedProgress,
    };
  });
  const totalPlannedHours = effortRows.reduce((sum, row) => sum + row.effortHours, 0);
  const plannedHoursToDate = effortRows.reduce(
    (sum, row) => sum + (row.effortHours * row.plannedProgress) / 100,
    0,
  );
  const earnedHours = effortRows.reduce(
    (sum, row) => sum + (row.effortHours * row.actualProgress) / 100,
    0,
  );
  const actualWorkLogs = workLogs.filter((log) => log.date <= asOfDate);
  const actualHours = actualWorkLogs.reduce((sum, log) => sum + log.hours, 0);
  const hasActual = actualWorkLogs.length > 0;
  const varianceHours = hasActual ? actualHours - plannedHoursToDate : null;
  const varianceRate =
    varianceHours != null && plannedHoursToDate > 0
      ? Math.round((varianceHours / plannedHoursToDate) * 100)
      : null;
  const plannedRate =
    totalPlannedHours > 0 ? Math.round((plannedHoursToDate / totalPlannedHours) * 100) : 0;
  const actualRate = totalPlannedHours > 0 ? Math.round((earnedHours / totalPlannedHours) * 100) : 0;
  const achievementRate =
    plannedRate > 0 ? Math.round((actualRate / plannedRate) * 100) : actualRate > 0 ? 100 : null;
  const onTimeCount = deliveryResults.filter((result) => result.actualEnd <= result.dueDate).length;

  return {
    delivery: {
      completedCount: deliveryTargets.length,
      evaluatedCount: deliveryResults.length,
      missingCompletionCount: deliveryTargets.length - deliveryResults.length,
      onTimeCount,
      rate:
        deliveryResults.length > 0
          ? Math.round((onTimeCount / deliveryResults.length) * 100)
          : null,
    },
    effort: {
      actualHours: roundHours(actualHours),
      hasActual,
      plannedHoursToDate: roundHours(plannedHoursToDate),
      totalPlannedHours: roundHours(totalPlannedHours),
      varianceHours: varianceHours == null ? null : roundHours(varianceHours),
      varianceRate,
    },
    progress: {
      achievementRate,
      actualRate,
      gapPoints: actualRate - plannedRate,
      plannedRate,
    },
  };
}

function getPlannedProgress(
  task: ScheduleTask,
  asOfDate: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
) {
  const { end, start } = getPlanRange(task);
  if (asOfDate < start) {
    return 0;
  }
  if (asOfDate >= end) {
    return 100;
  }
  const totalDays = getWorkingDays(start, end, calendar, calendarAware);
  const elapsedDays = getWorkingDays(start, asOfDate, calendar, calendarAware);
  if (totalDays > 0) {
    return clampPercent((elapsedDays / totalDays) * 100);
  }
  return clampPercent((daysInclusive(start, asOfDate) / Math.max(daysInclusive(start, end), 1)) * 100);
}

function getPlanRange(task: ScheduleTask) {
  return {
    end: task.baselineEnd ?? task.end,
    start: task.baselineStart ?? task.start,
  };
}

function getCompletionDateByTaskId(changeLogs: ScheduleChangeLog[]) {
  const completionDateByTaskId = new Map<string, { changedAt: string; date: string }>();
  changeLogs.forEach((log) => {
    if (log.field !== "status" || log.afterValue !== "done") {
      return;
    }
    const current = completionDateByTaskId.get(log.taskId);
    if (!current || current.changedAt < log.changedAt) {
      completionDateByTaskId.set(log.taskId, {
        changedAt: log.changedAt,
        date: log.changedAt.slice(0, 10),
      });
    }
  });
  return new Map(
    [...completionDateByTaskId].map(([taskId, completion]) => [taskId, completion.date]),
  );
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}
