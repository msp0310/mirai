import { useMemo } from "react";

import type { ScheduleSnapshot } from "../data/scheduleRepository";
import { isMemberActive } from "../lib/members";
import { buildCrossProjectResourceRows } from "../lib/resourceCalculations";
import { buildResourceMatrix, buildTimeline, buildWeekColumns } from "../lib/schedule";
import type { Member, ResourceScope, ScheduleTask, Team, TimelineColumn } from "../types/schedule";
import { isProjectArchived } from "./appState";

type UseWorkbenchResourcesOptions = {
  activeTeam: Team | undefined;
  activeTeamId: string;
  calendarAware: boolean;
  currentReviewSchedules: ScheduleSnapshot[];
  projectMembers: Member[];
  resourceScope: ResourceScope;
  resourceWeeks: TimelineColumn[];
  schedule: ScheduleSnapshot;
  tasks: ScheduleTask[];
};

/** 案件内・チーム横断の要員表示に必要な派生データをまとめます。 */
export function useWorkbenchResources({
  activeTeam,
  activeTeamId,
  calendarAware,
  currentReviewSchedules,
  projectMembers,
  resourceScope,
  resourceWeeks,
  schedule,
  tasks,
}: UseWorkbenchResourcesOptions) {
  const activeTeamReviewSchedules = useMemo(
    () =>
      currentReviewSchedules.filter(
        (snapshot) =>
          snapshot.project.teamId === (activeTeamId || null) &&
          !isProjectArchived(snapshot.project),
      ),
    [activeTeamId, currentReviewSchedules],
  );
  const teamResourceTasks = useMemo(
    () =>
      activeTeamReviewSchedules.flatMap((snapshot) =>
        snapshot.tasks.map((task) => ({
          ...task,
          sourceProjectId: snapshot.project.id,
          sourceProjectName: snapshot.project.workspace,
        })),
      ),
    [activeTeamReviewSchedules],
  );
  const teamResourceMembers = useMemo(() => {
    const teamMemberIds = new Set(activeTeam?.memberIds);
    const assignedMemberIds = new Set(teamResourceTasks.flatMap((task) => task.assigneeIds));
    const memberById = new Map<string, Member>();
    activeTeamReviewSchedules.forEach((snapshot) => {
      snapshot.members.forEach((member) => memberById.set(member.id, member));
    });
    const scopedMembers = [...memberById.values()].filter(
      (member) =>
        (teamMemberIds.has(member.id) && isMemberActive(member)) ||
        assignedMemberIds.has(member.id),
    );
    return scopedMembers.length > 0 ? scopedMembers : projectMembers;
  }, [activeTeam, activeTeamReviewSchedules, projectMembers, teamResourceTasks]);
  const teamResourceRange = useMemo(() => {
    if (activeTeamReviewSchedules.length === 0) {
      return {
        end: schedule.project.rangeEnd,
        start: schedule.project.rangeStart,
      };
    }
    const starts = activeTeamReviewSchedules.map((snapshot) => snapshot.project.rangeStart);
    const ends = activeTeamReviewSchedules.map((snapshot) => snapshot.project.rangeEnd);
    return {
      end: [...ends].toSorted().at(-1) ?? schedule.project.rangeEnd,
      start: [...starts].toSorted()[0] ?? schedule.project.rangeStart,
    };
  }, [activeTeamReviewSchedules, schedule.project.rangeEnd, schedule.project.rangeStart]);
  const teamResourceWeeks = useMemo(
    () =>
      buildWeekColumns(
        buildTimeline(
          teamResourceRange.start,
          teamResourceRange.end,
          schedule.calendar,
          calendarAware,
          "day",
        ),
      ),
    [calendarAware, schedule.calendar, teamResourceRange],
  );
  const teamResourceRows = useMemo(
    () =>
      buildCrossProjectResourceRows({
        baseCalendar: schedule.calendar,
        calendarAware,
        members: teamResourceMembers,
        schedules: activeTeamReviewSchedules,
        weeks: teamResourceWeeks,
      }),
    [
      activeTeamReviewSchedules,
      calendarAware,
      schedule.calendar,
      teamResourceMembers,
      teamResourceWeeks,
    ],
  );
  const resourceRows = useMemo(
    () =>
      buildResourceMatrix(tasks, projectMembers, resourceWeeks, schedule.calendar, calendarAware),
    [calendarAware, projectMembers, resourceWeeks, schedule.calendar, tasks],
  );

  return {
    activeTeamReviewSchedules,
    displayedResourceRows: resourceScope === "team" ? teamResourceRows : resourceRows,
    displayedResourceWeeks: resourceScope === "team" ? teamResourceWeeks : resourceWeeks,
    resourceRows,
  };
}
