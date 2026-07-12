import type { ScheduleSnapshot } from "../data/scheduleRepository";
import type {
  CalendarDefinition,
  Member,
  ResourceRowModel,
  ResourceTaskContribution,
  ScheduleTask,
  TimelineColumn,
  UtilizationTone,
} from "../types/schedule";
import { buildResourceMatrix } from "./schedule";

/** チーム横断の負荷計算に使うタスクへ、所属プロジェクト情報を付与します。 */
function addProjectContext(tasks: ScheduleTask[], snapshot: ScheduleSnapshot): ScheduleTask[] {
  return tasks.map((task) => ({
    ...task,
    sourceProjectId: snapshot.project.id,
    sourceProjectName: snapshot.project.workspace,
  }));
}

/** 利用率を、画面の警告色に対応する3段階へ変換します。 */
export function getResourceUtilizationTone(percent: number): UtilizationTone {
  if (percent >= 100) {
    return "danger";
  }
  if (percent >= 82) {
    return "warning";
  }
  return "good";
}

/**
 * 複数プロジェクトの負荷をメンバー・週単位で集約します。
 * セル検索をMap化し、プロジェクト数と週数が増えても線形に近い計算量を維持します。
 */
export function buildCrossProjectResourceRows({
  baseCalendar,
  calendarAware,
  members,
  schedules,
  weeks,
}: {
  baseCalendar: CalendarDefinition;
  calendarAware: boolean;
  members: Member[];
  schedules: ScheduleSnapshot[];
  weeks: TimelineColumn[];
}): ResourceRowModel[] {
  const baseRows = buildResourceMatrix([], members, weeks, baseCalendar, calendarAware);
  const rowsByMemberId = new Map<string, ResourceRowModel>(
    baseRows.map((row) => [
      row.member.id,
      {
        ...row,
        cells: row.cells.map((cell) => ({
          ...cell,
          contributions: [] as ResourceTaskContribution[],
          hours: 0,
          percent: 0,
          tone: "good" as UtilizationTone,
        })),
        utilization: 0,
      },
    ]),
  );

  schedules.forEach((snapshot) => {
    const projectRows = buildResourceMatrix(
      addProjectContext(snapshot.tasks, snapshot),
      members,
      weeks,
      snapshot.calendar,
      calendarAware,
    );

    projectRows.forEach((projectRow) => {
      const targetRow = rowsByMemberId.get(projectRow.member.id);
      if (!targetRow) {
        return;
      }
      const projectCellsByWeek = new Map(projectRow.cells.map((cell) => [cell.week, cell]));
      targetRow.cells = targetRow.cells.map((cell) => {
        const projectCell = projectCellsByWeek.get(cell.week);
        if (!projectCell || projectCell.contributions.length === 0) {
          return cell;
        }
        const contributions = [...cell.contributions, ...projectCell.contributions].toSorted(
          (a, b) => b.hours - a.hours || a.start.localeCompare(b.start),
        );
        const hours = Math.round(
          contributions.reduce((sum, contribution) => sum + contribution.hours, 0),
        );
        const percent =
          cell.capacityHours > 0
            ? Math.round((hours / cell.capacityHours) * 100)
            : hours > 0
              ? 100
              : 0;
        return {
          ...cell,
          contributions,
          hours,
          percent,
          tone: getResourceUtilizationTone(percent),
        };
      });
    });
  });

  return [...rowsByMemberId.values()].map((row) => ({
    ...row,
    utilization:
      row.cells.length > 0
        ? Math.round(row.cells.reduce((sum, cell) => sum + cell.percent, 0) / row.cells.length)
        : 0,
  }));
}
