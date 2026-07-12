import { useEffect, useMemo, useState } from "react";

import type { Member, ProjectIssue, ScheduleTask } from "../../../types/schedule";
import {
  buildWeeklyProgressRows,
  buildWeeklyTaskDetail,
  clampNumber,
  findCurrentWeek,
  getIssuesDueByWeek,
  getWeeklyProgressMetrics,
  isIssueResolved,
  visibleWeekCount,
} from "../model/weeklyProgress";

type UseWeeklyProgressSummaryOptions = {
  issues: ProjectIssue[];
  members: Member[];
  projectEnd: string;
  projectStart: string;
  tasks: ScheduleTask[];
  todayKey: string;
};

/** 週次進捗の選択状態と、各表示領域で共有するView Modelを組み立てます。 */
export function useWeeklyProgressSummary({
  issues,
  members,
  projectEnd,
  projectStart,
  tasks,
  todayKey,
}: UseWeeklyProgressSummaryOptions) {
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [weekWindowStart, setWeekWindowStart] = useState<number | null>(null);
  const rows = useMemo(
    () => buildWeeklyProgressRows(tasks, projectStart, projectEnd),
    [projectEnd, projectStart, tasks],
  );
  const actionableTasks = useMemo(() => tasks.filter((task) => task.type === "task"), [tasks]);
  const currentWeek = useMemo(
    () => findCurrentWeek(rows, todayKey, projectStart),
    [projectStart, rows, todayKey],
  );
  const currentWeekIndex = currentWeek
    ? Math.max(
        rows.findIndex((row) => row.weekKey === currentWeek.weekKey),
        0,
      )
    : 0;
  const maxWeekWindowStart = Math.max(rows.length - visibleWeekCount, 0);
  const defaultWeekWindowStart = clampNumber(currentWeekIndex - 1, 0, maxWeekWindowStart);
  const activeWeekWindowStart = clampNumber(
    weekWindowStart ?? defaultWeekWindowStart,
    0,
    maxWeekWindowStart,
  );
  const visibleRows = rows.slice(activeWeekWindowStart, activeWeekWindowStart + visibleWeekCount);
  const selectedWeek =
    rows.find((row) => row.weekKey === (selectedWeekKey ?? currentWeek?.weekKey)) ?? currentWeek;
  const metrics = useMemo(
    () => getWeeklyProgressMetrics(actionableTasks, rows, currentWeek),
    [actionableTasks, currentWeek, rows],
  );
  const detail = useMemo(
    () => buildWeeklyTaskDetail(selectedWeek, actionableTasks, members),
    [actionableTasks, members, selectedWeek],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const selectedWeekIssues = useMemo(
    () => (selectedWeek ? getIssuesDueByWeek(issues, selectedWeek.end) : []),
    [issues, selectedWeek],
  );
  const unresolvedIssueCount = selectedWeekIssues.filter((issue) => !isIssueResolved(issue)).length;

  useEffect(() => {
    setSelectedWeekKey(null);
    setWeekWindowStart(null);
  }, [projectEnd, projectStart]);

  function moveWeekWindow(direction: -1 | 1) {
    const nextStart = clampNumber(
      activeWeekWindowStart + direction * visibleWeekCount,
      0,
      maxWeekWindowStart,
    );
    setWeekWindowStart(nextStart);
    setSelectedWeekKey(rows[Math.min(nextStart + 1, rows.length - 1)]?.weekKey ?? null);
  }

  function moveToCurrentWeek() {
    setWeekWindowStart(defaultWeekWindowStart);
    setSelectedWeekKey(currentWeek?.weekKey ?? null);
  }

  return {
    activeWeekWindowStart,
    currentWeek,
    currentWeekIndex,
    detail,
    maxWeekWindowStart,
    memberById,
    metrics,
    moveToCurrentWeek,
    moveWeekWindow,
    rows,
    selectedWeek,
    selectedWeekIssues,
    selectWeek: setSelectedWeekKey,
    unresolvedIssueCount,
    visibleRows,
  };
}
