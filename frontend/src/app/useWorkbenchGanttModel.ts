import { useMemo } from "react";

import type { ScheduleSnapshot } from "../data/scheduleRepository";
import { getActiveMembers, isMemberActive } from "../lib/members";
import { getProjectAssignedMembers } from "../lib/projects";
import {
  buildGanttHeaderColumns,
  buildTimeline,
  buildWeekColumns,
  filterTaskRows,
  flattenTasks,
} from "../lib/schedule";
import type { GanttTimeUnit, ScheduleFilters, ScheduleTask, Team } from "../types/schedule";
import { getGanttTimelineRange } from "./appState";

type UseWorkbenchGanttModelOptions = {
  activeProjectId: string;
  activeTeam?: Team;
  calendarAware: boolean;
  collapsedIdsByProject: Record<string, string[]>;
  filters: ScheduleFilters;
  schedule: ScheduleSnapshot;
  tasks: ScheduleTask[];
  timeUnit: GanttTimeUnit;
};

/** GanttとResourceで共有する、案件単位の表示モデルをメモ化して構築します。 */
export function useWorkbenchGanttModel({
  activeProjectId,
  activeTeam,
  calendarAware,
  collapsedIdsByProject,
  filters,
  schedule,
  tasks,
  timeUnit,
}: UseWorkbenchGanttModelOptions) {
  const timelineRange = useMemo(
    () => getGanttTimelineRange(tasks, schedule.project),
    [schedule.project, tasks],
  );
  const timeline = useMemo(
    () =>
      buildTimeline(
        timelineRange.start,
        timelineRange.end,
        schedule.calendar,
        calendarAware,
        timeUnit,
      ),
    [calendarAware, schedule.calendar, timeUnit, timelineRange.end, timelineRange.start],
  );
  const dayTimeline = useMemo(
    () =>
      buildTimeline(
        timelineRange.start,
        timelineRange.end,
        schedule.calendar,
        calendarAware,
        "day",
      ),
    [calendarAware, schedule.calendar, timelineRange.end, timelineRange.start],
  );
  const ganttColumns = useMemo(
    () => buildGanttHeaderColumns(timeline, timeUnit),
    [timeline, timeUnit],
  );
  const resourceWeeks = useMemo(() => buildWeekColumns(dayTimeline), [dayTimeline]);
  const collapsedIds = useMemo(
    () => new Set(collapsedIdsByProject[activeProjectId]),
    [activeProjectId, collapsedIdsByProject],
  );
  const flattenedRows = useMemo(() => flattenTasks(tasks, collapsedIds), [collapsedIds, tasks]);
  const visibleRows = useMemo(
    () => filterTaskRows(flattenedRows, filters),
    [filters, flattenedRows],
  );
  const projectMembers = useMemo(() => {
    const projectMemberIds = new Set(
      getProjectAssignedMembers({
        members: schedule.members,
        project: schedule.project,
        team: activeTeam,
      }).map((member) => member.id),
    );
    const assignedMemberIds = new Set(tasks.flatMap((task) => task.assigneeIds));
    const scopedMembers = schedule.members.filter(
      (member) =>
        (projectMemberIds.has(member.id) && isMemberActive(member)) ||
        assignedMemberIds.has(member.id),
    );
    return scopedMembers.length > 0 ? scopedMembers : getActiveMembers(schedule.members);
  }, [activeTeam, schedule.members, schedule.project, tasks]);

  return {
    collapsedIds,
    ganttColumns,
    projectMembers,
    resourceWeeks,
    timeline,
    visibleRows,
  };
}
