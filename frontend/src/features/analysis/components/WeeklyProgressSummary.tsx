import { useMemo, useState } from "react";
import type { ScheduleTask } from "../../../types/schedule";
import { addDays, parseDate, toDateKey } from "../../../lib/schedule";

type WeeklyProgressSummaryProps = {
  projectEnd: string;
  projectStart: string;
  tasks: ScheduleTask[];
};

export type WeeklyProgressRow = {
  completed: number;
  currentProgress: number;
  delayed: number;
  end: string;
  inProgress: number;
  planned: number;
  start: string;
  targetCount: number;
  weekKey: string;
};

/** 案件期間を週単位に区切り、現在のタスク状態を集計します。 */
export function buildWeeklyProgressRows(
  tasks: ScheduleTask[],
  projectStart: string,
  projectEnd: string,
): WeeklyProgressRow[] {
  const rows = createWeekRows(projectStart, projectEnd);
  const rowsByWeek = new Map(rows.map((row) => [row.weekKey, row]));
  const actionableTasks = tasks.filter((task) => task.type === "task");

  actionableTasks.forEach((task) => {
    const endWeek = getWeekStartKey(clampDate(task.end, projectStart, projectEnd));
    const dueRow = rowsByWeek.get(endWeek);
    if (dueRow) {
      dueRow.planned += 1;
      dueRow.completed += task.status === "done" ? 1 : 0;
      dueRow.delayed += task.status === "delayed" ? 1 : 0;
    }

    rows.forEach((row) => {
      if (task.start > row.end || task.end < row.start) return;
      if (task.status === "inProgress") row.inProgress += 1;
      row.currentProgress += task.progress;
      row.targetCount += 1;
    });
  });

  return rows.map((row) => ({
    ...row,
    currentProgress: row.targetCount > 0
      ? Math.round(row.currentProgress / row.targetCount)
      : 0,
  }));
}

/** 週次の完了状況を、期間の長い案件でも読みやすく表示します。 */
export function WeeklyProgressSummary({
  projectEnd,
  projectStart,
  tasks,
}: WeeklyProgressSummaryProps) {
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const rows = useMemo(
    () => buildWeeklyProgressRows(tasks, projectStart, projectEnd),
    [projectEnd, projectStart, tasks],
  );
  const visibleRows = showAllWeeks ? rows : rows.slice(-12);
  const totalCompleted = tasks.filter(
    (task) => task.type === "task" && task.status === "done",
  ).length;
  const delayedCount = tasks.filter(
    (task) => task.type === "task" && task.status === "delayed",
  ).length;

  return (
    <section className="dashboard-panel weekly-progress-panel" aria-label="週次進捗サマリー">
      <div className="weekly-progress-heading">
        <div>
          <h2>週次進捗サマリー</h2>
          <p>予定終了週ごとに、完了・進行中・遅延の状況を集計しています。</p>
        </div>
        <div className="weekly-progress-meta">
          <strong>{rows.length}週</strong>
          <span>完了 {totalCompleted}件 / 遅延 {delayedCount}件</span>
        </div>
      </div>

      <div className="weekly-progress-table-wrap">
        <table className="weekly-progress-table">
          <thead>
            <tr>
              <th scope="col">週</th>
              <th scope="col">完了</th>
              <th scope="col">進行中</th>
              <th scope="col">終了予定</th>
              <th scope="col">遅延</th>
              <th scope="col">現在進捗</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const completionRate = row.planned > 0
                ? Math.round((row.completed / row.planned) * 100)
                : 0;
              return (
                <tr className={row.delayed > 0 ? "has-delay" : undefined} key={row.start}>
                  <th scope="row">
                    <strong>{formatWeekLabel(row.start)}</strong>
                    <small>{row.start.slice(5).replace("-", "/")} - {row.end.slice(5).replace("-", "/")}</small>
                  </th>
                  <td className="weekly-progress-completed">{row.completed}件</td>
                  <td>{row.inProgress}件</td>
                  <td>{row.planned}件</td>
                  <td className={row.delayed > 0 ? "weekly-progress-delayed" : undefined}>
                    {row.delayed}件
                  </td>
                  <td>
                    <div className="weekly-progress-cell">
                      <span>{completionRate}%</span>
                      <span className="weekly-progress-meter">
                        <span style={{ width: `${completionRate}%` }} />
                      </span>
                      <small>対象 {row.currentProgress}%</small>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 12 ? (
        <button
          className="weekly-progress-toggle"
          onClick={() => setShowAllWeeks((current) => !current)}
          type="button"
        >
          {showAllWeeks ? "直近12週のみ表示" : `全${rows.length}週を表示`}
        </button>
      ) : null}
      <small className="weekly-progress-note">
        完了率は、その週に終了予定のタスクのうち完了済みの割合です。対象進捗は、その週にかかるタスクの現在値です。
      </small>
    </section>
  );
}

function createWeekRows(projectStart: string, projectEnd: string): WeeklyProgressRow[] {
  const rows: WeeklyProgressRow[] = [];
  let cursor = parseDate(getWeekStartKey(projectStart));
  const rangeEnd = parseDate(projectEnd);

  while (cursor <= rangeEnd) {
    const weekStart = toDateKey(cursor);
    const weekEnd = toDateKey(addDays(cursor, 6));
    rows.push({
      completed: 0,
      currentProgress: 0,
      delayed: 0,
      end: weekEnd < projectEnd ? weekEnd : projectEnd,
      inProgress: 0,
      planned: 0,
      start: weekStart > projectStart ? weekStart : projectStart,
      targetCount: 0,
      weekKey: weekStart,
    });
    cursor = addDays(cursor, 7);
  }
  return rows;
}

function getWeekStartKey(value: string) {
  const date = parseDate(value);
  const day = date.getDay();
  return toDateKey(addDays(date, day === 0 ? -6 : 1 - day));
}

function clampDate(value: string, start: string, end: string) {
  return value < start ? start : value > end ? end : value;
}

function formatWeekLabel(start: string) {
  return `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))}週`;
}
