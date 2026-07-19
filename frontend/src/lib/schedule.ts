import type {
  CalendarDefinition,
  GanttTimeUnit,
  Member,
  ProgressStats,
  ResourceRowModel,
  ScheduleFilters,
  ScheduleTask,
  TaskRow,
  TaskStatus,
  TimelineColumn,
  TimelineDay,
  UtilizationTone,
} from "../types/schedule";

const dayMs = 24 * 60 * 60 * 1000;

export const statusLabels: Record<TaskStatus, string> = {
  notStarted: "未着手",
  inProgress: "進行中",
  done: "完了",
  delayed: "遅延",
};

export type DependencyIssue = {
  dateOrder: boolean;
  dependency: ScheduleTask;
  incomplete: boolean;
};
export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}
export function diffDays(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / dayMs);
}
export function daysInclusive(start: string, end: string): number {
  return diffDays(start, end) + 1;
}
export function isWorkingDay(
  date: Date,
  calendar: CalendarDefinition,
  includeCalendar = true,
): boolean {
  if (!includeCalendar) {
    return true;
  }
  const key = toDateKey(date);
  const isHoliday = calendar.holidays.some((item) => item.date === key);
  return calendar.workWeek.includes(date.getDay()) && !isHoliday;
}
export function addWorkingDays(
  start: string,
  workingDays: number,
  calendar: CalendarDefinition,
  includeCalendar = true,
): string {
  if (!includeCalendar) {
    return toDateKey(addDays(parseDate(start), Math.max(workingDays, 1) - 1));
  }

  let date = parseDate(start);
  let counted = 0;
  const requiredDays = Math.max(workingDays, 1);

  while (counted < requiredDays) {
    if (isWorkingDay(date, calendar, includeCalendar)) {
      counted += 1;
    }
    if (counted >= requiredDays) {
      break;
    }
    date = addDays(date, 1);
  }

  return toDateKey(date);
}
export function extendEndForWorkingDays(
  start: string,
  workingDays: number,
  calendar: CalendarDefinition,
  includeCalendar = true,
): string {
  return addWorkingDays(start, workingDays, calendar, includeCalendar);
}
export function getDateDeltaForTimeUnit(
  dateKey: string,
  unit: GanttTimeUnit,
  deltaUnits: number,
): number {
  if (deltaUnits === 0) {
    return 0;
  }
  const date = parseDate(dateKey);
  const next =
    unit === "month"
      ? addMonths(date, deltaUnits)
      : addDays(date, deltaUnits * (unit === "week" ? 7 : 1));
  return diffDays(dateKey, toDateKey(next));
}

function startOfWeek(date: Date): Date {
  return addDays(date, date.getDay() === 0 ? -6 : 1 - date.getDay());
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
export function buildTimeline(
  start: string,
  end: string,
  calendar: CalendarDefinition,
  includeNonWorking = true,
  unit: GanttTimeUnit = "day",
): TimelineDay[] {
  if (unit === "day") {
    const first = parseDate(start);
    const total = daysInclusive(start, end);
    return Array.from({ length: total }, (_, index) => {
      const date = addDays(first, index);
      return buildTimelineSlot(date, date, index, calendar, includeNonWorking);
    });
  }

  const slots: TimelineDay[] = [];
  const rangeEnd = parseDate(end);
  let cursor = unit === "week" ? startOfWeek(parseDate(start)) : startOfMonth(parseDate(start));
  let index = 0;
  while (cursor <= rangeEnd) {
    const slotEnd = unit === "week" ? endOfWeek(cursor) : endOfMonth(cursor);
    slots.push(buildTimelineSlot(cursor, slotEnd, index, calendar, includeNonWorking, unit));
    cursor = unit === "week" ? addDays(cursor, 7) : startOfMonth(addMonths(cursor, 1));
    index += 1;
  }
  return slots;
}

function buildTimelineSlot(
  date: Date,
  endDate: Date,
  index: number,
  calendar: CalendarDefinition,
  includeNonWorking: boolean,
  unit: GanttTimeUnit = "day",
): TimelineDay {
  const key = toDateKey(date);
  const endKey = toDateKey(endDate);
  const holiday = calendar.holidays.find((item) => item.date === key);
  const isWeekend = !calendar.workWeek.includes(date.getDay());
  return {
    key,
    start: key,
    end: endKey,
    date,
    index,
    spanDays: daysInclusive(key, endKey),
    label: getTimelineSlotLabel(date, unit),
    subLabel: unit === "day" ? undefined : formatShortDate(key),
    day: date.getDate(),
    weekday: date.getDay(),
    month: date.getMonth() + 1,
    isWeekend,
    holiday,
    isNonWorking:
      unit === "day" && includeNonWorking && !isWorkingDay(date, calendar, includeNonWorking),
  };
}

function getTimelineSlotLabel(date: Date, unit: GanttTimeUnit): string {
  if (unit === "month") {
    return `${date.getMonth() + 1}月`;
  }
  if (unit === "week") {
    return `W${getWeekNumber(date)}`;
  }
  return String(date.getDate());
}
export function buildWeekColumns(days: TimelineDay[]): TimelineColumn[] {
  const columns: TimelineColumn[] = [];
  let current: TimelineColumn | null = null;

  days.forEach((day) => {
    const monday = addDays(day.date, day.weekday === 0 ? -6 : 1 - day.weekday);
    const weekKey = toDateKey(monday);
    if (!current || current.key !== weekKey) {
      current = {
        key: weekKey,
        label: `W${getWeekNumber(day.date)} ${day.month}/${day.day}`,
        startIndex: day.index,
        span: 0,
        start: day.key,
      };
      columns.push(current);
    }
    current.span += 1;
  });

  return columns;
}
export function buildMonthColumns(days: TimelineDay[]): TimelineColumn[] {
  const columns: TimelineColumn[] = [];
  let current: TimelineColumn | null = null;

  days.forEach((day) => {
    const monthKey = `${day.date.getFullYear()}-${day.month}`;
    if (!current || current.key !== monthKey) {
      current = {
        key: monthKey,
        label: `${day.date.getFullYear()}年${day.month}月`,
        startIndex: day.index,
        span: 0,
      };
      columns.push(current);
    }
    current.span += 1;
  });

  return columns;
}
export function buildYearColumns(days: TimelineDay[]): TimelineColumn[] {
  const columns: TimelineColumn[] = [];
  let current: TimelineColumn | null = null;

  days.forEach((day) => {
    const yearKey = String(day.date.getFullYear());
    if (!current || current.key !== yearKey) {
      current = {
        key: yearKey,
        label: `${day.date.getFullYear()}年`,
        startIndex: day.index,
        span: 0,
      };
      columns.push(current);
    }
    current.span += 1;
  });

  return columns;
}
export function buildUnitColumns(days: TimelineDay[]): TimelineColumn[] {
  return days.map((day) => ({
    key: day.key,
    label: day.label,
    startIndex: day.index,
    span: 1,
    start: day.start,
  }));
}
export function buildGanttHeaderColumns(
  days: TimelineDay[],
  unit: GanttTimeUnit,
): { primary: TimelineColumn[]; secondary: TimelineColumn[] } {
  if (unit === "month") {
    return {
      primary: buildYearColumns(days),
      secondary: buildUnitColumns(days),
    };
  }
  if (unit === "week") {
    return {
      primary: buildMonthColumns(days),
      secondary: buildUnitColumns(days),
    };
  }
  return {
    primary: buildMonthColumns(days),
    secondary: buildUnitColumns(days),
  };
}
export function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstDay.getTime()) / dayMs);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

/**
 * タスク階層を表示順の行へ平坦化します。
 * 配列コピーと再帰を避け、行数と階層の深さが増えてもスタックオーバーフローや
 * 不要な二次計算を起こさないようにします。
 */
export function flattenTasks(tasks: ScheduleTask[], collapsedIds = new Set<string>()): TaskRow[] {
  const childrenByParent = new Map<string, ScheduleTask[]>();
  tasks.forEach((task) => {
    const key = task.parentId ?? "root-level";
    const children = childrenByParent.get(key);
    if (children) {
      children.push(task);
    } else {
      childrenByParent.set(key, [task]);
    }
  });

  const rows: TaskRow[] = [];
  const stack = [...(childrenByParent.get("root-level") ?? [])]
    .toReversed()
    .map((task) => ({ depth: 0, task }));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const children = childrenByParent.get(current.task.id) ?? [];
    rows.push({
      ...current.task,
      depth: current.depth,
      hasChildren: children.length > 0,
    });
    if (collapsedIds.has(current.task.id)) {
      continue;
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: current.depth + 1, task: children[index] });
    }
  }

  return rows;
}
export function filterTaskRows(rows: TaskRow[], filters: ScheduleFilters): TaskRow[] {
  const statusMatchedRows = rows.filter(
    (task) => filters.statuses[task.status] || task.type !== "task",
  );
  if (filters.assigneeId === "all") {
    return statusMatchedRows;
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const visibleIds = new Set<string>();
  statusMatchedRows.forEach((task) => {
    const directlyMatches =
      filters.assigneeId === "unassigned"
        ? (task.type === "task" || task.type === "milestone") && task.assigneeIds.length === 0
        : task.assigneeIds.includes(filters.assigneeId);
    if (!directlyMatches) {
      return;
    }

    let current: TaskRow | undefined = task;
    while (current) {
      visibleIds.add(current.id);
      current = current.parentId ? rowById.get(current.parentId) : undefined;
    }
  });

  return rows.filter((task) => visibleIds.has(task.id));
}
export function taskMatchesQuery(
  task: Pick<ScheduleTask, "assigneeIds" | "title">,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    normalizedQuery.length > 0 &&
    (task.title.toLowerCase().includes(normalizedQuery) ||
      task.assigneeIds.some((id) => id.toLowerCase().includes(normalizedQuery)))
  );
}
export function getDependencyIssues(
  task: Pick<ScheduleTask, "dependencies" | "start">,
  tasks: ScheduleTask[] | Map<string, ScheduleTask>,
): DependencyIssue[] {
  const taskById = Array.isArray(tasks) ? new Map(tasks.map((item) => [item.id, item])) : tasks;
  return (task.dependencies ?? [])
    .map((dependencyId) => taskById.get(dependencyId))
    .filter((dependency): dependency is ScheduleTask => Boolean(dependency))
    .map((dependency) => ({
      dateOrder: dependency.end >= task.start,
      dependency,
      incomplete: dependency.status !== "done",
    }))
    .filter((issue) => issue.dateOrder || issue.incomplete);
}
export function getTaskSpan(
  task: ScheduleTask,
  rangeStart: string,
): { offset: number; duration: number } {
  const offset = diffDays(rangeStart, task.start);
  const duration = Math.max(daysInclusive(task.start, task.end), 1);
  return { offset, duration };
}
export function getTimelineSlotIndex(dateKey: string, timeline: TimelineDay[]): number {
  if (timeline.length === 0) {
    return 0;
  }
  const slotIndex = timeline.findIndex((day) => dateKey >= day.start && dateKey <= day.end);
  if (slotIndex !== -1) {
    return slotIndex;
  }
  if (dateKey < timeline[0].start) {
    return 0;
  }
  return timeline.length - 1;
}
export function getTaskTimelineSpan(
  task: ScheduleTask,
  timeline: TimelineDay[],
): { offset: number; duration: number } {
  if (timeline.length === 0) {
    return { offset: 0, duration: 1 };
  }
  const offset = getTimelineSlotIndex(task.start, timeline);
  const end = getTimelineSlotIndex(task.end, timeline);
  return {
    offset,
    duration: Math.max(end - offset + 1, 1),
  };
}
export function getProgressStats(tasks: ScheduleTask[]): ProgressStats {
  const actionable = tasks.filter((task) => task.type === "task");
  const delayed = actionable.filter((task) => task.status === "delayed").length;
  const completed = actionable.filter((task) => task.status === "done").length;
  const totalProgress = actionable.reduce((sum, task) => sum + task.progress, 0);
  return {
    delayed,
    completed,
    total: actionable.length,
    progress: actionable.length > 0 ? Math.round(totalProgress / actionable.length) : 0,
  };
}
export function getWorkingDays(
  start: string,
  end: string,
  calendar: CalendarDefinition,
  includeCalendar = true,
): number {
  if (end < start) {
    return 0;
  }
  const first = parseDate(start);
  const total = daysInclusive(start, end);
  return Array.from({ length: total }, (_, index) => addDays(first, index)).filter((date) =>
    isWorkingDay(date, calendar, includeCalendar),
  ).length;
}
export function getMemberUnavailableDates(member: Pick<Member, "availabilityOverrides">) {
  return new Set(
    (member.availabilityOverrides ?? [])
      .filter((override) => override.type === "unavailable")
      .map((override) => override.date),
  );
}

function getMemberAvailableWorkingDays(
  start: string,
  end: string,
  calendar: CalendarDefinition,
  member: Pick<Member, "availabilityOverrides">,
  includeCalendar = true,
): number {
  if (end < start) {
    return 0;
  }
  const unavailableDates = getMemberUnavailableDates(member);
  const first = parseDate(start);
  const total = daysInclusive(start, end);
  return Array.from({ length: total }, (_, index) => addDays(first, index)).filter((date) => {
    const key = toDateKey(date);
    return isWorkingDay(date, calendar, includeCalendar) && !unavailableDates.has(key);
  }).length;
}

function getMemberUnavailableWorkingDays(
  start: string,
  end: string,
  calendar: CalendarDefinition,
  member: Pick<Member, "availabilityOverrides">,
  includeCalendar = true,
): number {
  const calendarWorkingDays = getWorkingDays(start, end, calendar, includeCalendar);
  const memberWorkingDays = getMemberAvailableWorkingDays(
    start,
    end,
    calendar,
    member,
    includeCalendar,
  );
  return Math.max(calendarWorkingDays - memberWorkingDays, 0);
}
export function getWorkingDaySpan(
  start: string,
  end: string,
  calendar: CalendarDefinition,
  includeCalendar = true,
): number {
  return Math.max(getWorkingDays(start, end, calendar, includeCalendar), 1);
}
export function getTaskAssigneeAllocationMap(
  task: Pick<ScheduleTask, "assigneeAllocations" | "assigneeIds">,
) {
  const allocationMap = new Map<string, number>();
  const assigneeIds = [...new Set(task.assigneeIds)];
  if (assigneeIds.length === 0) {
    return allocationMap;
  }
  if (assigneeIds.length === 1) {
    allocationMap.set(assigneeIds[0], 100);
    return allocationMap;
  }

  const explicitAllocations = new Map(
    (task.assigneeAllocations ?? [])
      .filter(
        (allocation) =>
          assigneeIds.includes(allocation.memberId) &&
          Number.isFinite(allocation.percent) &&
          allocation.percent > 0,
      )
      .map((allocation) => [allocation.memberId, Math.min(Math.max(allocation.percent, 0), 100)]),
  );
  const explicitTotal = [...explicitAllocations.values()].reduce(
    (sum, percent) => sum + percent,
    0,
  );

  if (explicitAllocations.size === 0 || explicitTotal <= 0) {
    const equalShare = 100 / assigneeIds.length;
    assigneeIds.forEach((memberId) => allocationMap.set(memberId, equalShare));
    return allocationMap;
  }

  if (explicitTotal >= 100) {
    assigneeIds.forEach((memberId) => {
      const percent = explicitAllocations.get(memberId) ?? 0;
      allocationMap.set(memberId, (percent / explicitTotal) * 100);
    });
    return allocationMap;
  }

  const missingMemberIds = assigneeIds.filter((memberId) => !explicitAllocations.has(memberId));
  const missingShare =
    missingMemberIds.length > 0 ? (100 - explicitTotal) / missingMemberIds.length : 0;
  assigneeIds.forEach((memberId) => {
    allocationMap.set(memberId, explicitAllocations.get(memberId) ?? missingShare);
  });
  return allocationMap;
}
export function getTaskAssigneeAllocationPercent(
  task: Pick<ScheduleTask, "assigneeAllocations" | "assigneeIds">,
  memberId: string,
) {
  return getTaskAssigneeAllocationMap(task).get(memberId) ?? 0;
}
export function buildResourceMatrix(
  tasks: (ScheduleTask & {
    sourceProjectId?: string;
    sourceProjectName?: string;
  })[],
  members: Member[],
  weeks: TimelineColumn[],
  calendar: CalendarDefinition,
  includeCalendar = true,
): ResourceRowModel[] {
  const actionable = tasks.filter((task) => task.type === "task");
  const actionableByMember = new Map<
    string,
    {
      allocationPercent: number;
      task: (typeof actionable)[number];
      taskHours: number;
      totalWorkingDays: number;
    }[]
  >();
  actionable.forEach((task) => {
    const totalWorkingDays = Math.max(
      getWorkingDays(task.start, task.end, calendar, includeCalendar),
      1,
    );
    const taskHours = task.effortHours ?? totalWorkingDays * 8;
    task.assigneeIds.forEach((memberId) => {
      const allocationPercent = getTaskAssigneeAllocationPercent(task, memberId);
      if (allocationPercent <= 0) {
        return;
      }
      actionableByMember.set(memberId, [
        ...(actionableByMember.get(memberId) ?? []),
        {
          allocationPercent,
          task,
          taskHours,
          totalWorkingDays,
        },
      ]);
    });
  });
  return members.map((member) => {
    const assignedTasks = actionableByMember.get(member.id) ?? [];
    const cells = weeks.map((week) => {
      const weekStart = parseDate(week.start ?? week.key);
      const weekEnd = addDays(weekStart, week.span - 1);
      const weekStartKey = toDateKey(weekStart);
      const weekEndKey = toDateKey(weekEnd);
      const weekWorkingDays = getWorkingDays(weekStartKey, weekEndKey, calendar, includeCalendar);
      const availableWorkingDays = getMemberAvailableWorkingDays(
        weekStartKey,
        weekEndKey,
        calendar,
        member,
        includeCalendar,
      );
      const unavailableDays = getMemberUnavailableWorkingDays(
        weekStartKey,
        weekEndKey,
        calendar,
        member,
        includeCalendar,
      );
      const capacityHours =
        weekWorkingDays > 0
          ? (member.capacityHours / weekWorkingDays) * availableWorkingDays
          : member.capacityHours;
      const contributions = assignedTasks
        .flatMap(({ allocationPercent, task, taskHours, totalWorkingDays }) => {
          const taskStart = parseDate(task.start);
          const taskEnd = parseDate(task.end);
          const overlapStart = taskStart > weekStart ? taskStart : weekStart;
          const overlapEnd = taskEnd < weekEnd ? taskEnd : weekEnd;
          if (overlapStart > overlapEnd) {
            return [];
          }
          const workingDays = getWorkingDays(
            toDateKey(overlapStart),
            toDateKey(overlapEnd),
            calendar,
            includeCalendar,
          );
          const contributionHours =
            ((taskHours / totalWorkingDays) * workingDays * allocationPercent) / 100;
          if (contributionHours <= 0) {
            return [];
          }
          return [
            {
              allocationPercent: Math.round(allocationPercent),
              assigneeCount: task.assigneeIds.length,
              end: task.end,
              hours: roundResourceContributionHours(contributionHours),
              progress: task.progress,
              projectId: task.sourceProjectId,
              projectName: task.sourceProjectName,
              start: task.start,
              status: task.status,
              taskId: task.id,
              title: task.title,
            },
          ];
        })
        .toSorted((a, b) => b.hours - a.hours || a.start.localeCompare(b.start));
      const hours = contributions.reduce((sum, contribution) => sum + contribution.hours, 0);
      const percent =
        capacityHours > 0 ? Math.round((hours / capacityHours) * 100) : hours > 0 ? 100 : 0;
      let tone: UtilizationTone = "good";
      if (percent >= 100) {
        tone = "danger";
      } else if (percent >= 82) {
        tone = "warning";
      }
      return {
        capacityHours: Math.round(capacityHours),
        contributions,
        week: week.key,
        hours: Math.round(hours),
        percent,
        tone,
        unavailableDays,
      };
    });
    const average = cells.reduce((sum, cell) => sum + cell.percent, 0) / cells.length;
    return {
      member,
      utilization: Math.round(average),
      cells,
    };
  });
}

function roundResourceContributionHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}
export function formatShortDate(dateKey: string): string {
  const date = parseDate(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
export function formatDateWithWeekday(dateKey: string): string {
  const date = parseDate(dateKey);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}
