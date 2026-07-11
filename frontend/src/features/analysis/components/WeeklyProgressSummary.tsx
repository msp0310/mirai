import { useMemo, useState } from "react";
import type { Member, ScheduleTask } from "../../../types/schedule";
import { addDays, formatShortDate, parseDate, statusLabels, toDateKey } from "../../../lib/schedule";

type WeeklyProgressSummaryProps = {
  members: Member[];
  onSelectTask: (taskId: string) => void;
  projectEnd: string;
  projectStart: string;
  tasks: ScheduleTask[];
  todayKey: string;
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

type WeeklyTaskGroup = {
  member: Member | null;
  memberId: string;
  tasks: ScheduleTask[];
};

const unassignedMemberId = "__unassigned__";
const maxDetailTasks = 80;

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
  members,
  onSelectTask,
  projectEnd,
  projectStart,
  tasks,
  todayKey,
}: WeeklyProgressSummaryProps) {
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const rows = useMemo(
    () => buildWeeklyProgressRows(tasks, projectStart, projectEnd),
    [projectEnd, projectStart, tasks],
  );
  const visibleRows = showAllWeeks ? rows : rows.slice(-12);
  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.type === "task"),
    [tasks],
  );
  const currentWeek = useMemo(
    () =>
      rows.find((row) => row.start <= todayKey && todayKey <= row.end) ??
      rows[rows.length - 1],
    [rows, todayKey],
  );
  const selectedWeek = rows.find((row) => row.weekKey === (selectedWeekKey ?? currentWeek?.weekKey)) ?? currentWeek;
  const totalCompleted = actionableTasks.filter((task) => task.status === "done").length;
  const delayedCount = actionableTasks.filter((task) => task.status === "delayed").length;
  const actualCompletionRate = actionableTasks.length > 0
    ? Math.round((totalCompleted / actionableTasks.length) * 100)
    : 0;
  const plannedCompletionCount = currentWeek
    ? rows
        .filter((row) => row.weekKey <= currentWeek.weekKey)
        .reduce((sum, row) => sum + row.planned, 0)
    : 0;
  const plannedCompletionRate = actionableTasks.length > 0
    ? Math.round((plannedCompletionCount / actionableTasks.length) * 100)
    : 0;
  const completionGap = actualCompletionRate - plannedCompletionRate;
  const detail = useMemo(() => {
    if (!selectedWeek) return { groups: [], hiddenCount: 0, totalCount: 0 };
    const groups = buildWeeklyTaskGroups(selectedWeek, actionableTasks, members);
    const totalCount = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id))).size;
    let remaining = maxDetailTasks;
    const visibleGroups = groups.map((group) => {
      const visibleTasks = group.tasks.slice(0, Math.min(group.tasks.length, remaining));
      remaining -= visibleTasks.length;
      return { ...group, tasks: visibleTasks };
    }).filter((group) => group.tasks.length > 0);
    return {
      groups: visibleGroups,
      hiddenCount: Math.max(totalCount - (maxDetailTasks - remaining), 0),
      totalCount,
    };
  }, [actionableTasks, members, selectedWeek]);

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

      <div className="weekly-progress-overview" aria-label="プロジェクト全体の計画と実績">
        <div>
          <span>{currentWeek ? `${formatWeekLabel(currentWeek.start)}時点の計画` : "計画"}</span>
          <strong>{plannedCompletionRate}%</strong>
        </div>
        <div>
          <span>現在の実績</span>
          <strong>{actualCompletionRate}%</strong>
        </div>
        <div className={completionGap < 0 ? "behind" : completionGap > 0 ? "ahead" : "on-track"}>
          <span>計画との差</span>
          <strong>{completionGap > 0 ? "+" : ""}{completionGap}pt</strong>
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
              <th scope="col">詳細</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const completionRate = row.planned > 0
                ? Math.round((row.completed / row.planned) * 100)
                : 0;
              const isSelected = row.weekKey === selectedWeek?.weekKey;
              return (
                <tr
                  className={[row.delayed > 0 ? "has-delay" : "", isSelected ? "selected" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  key={row.start}
                >
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
                  <td>
                    <button
                      aria-label={`${formatWeekLabel(row.start)}の担当別タスクを表示`}
                      aria-pressed={isSelected}
                      className="weekly-progress-detail-button"
                      onClick={() => setSelectedWeekKey(row.weekKey)}
                      type="button"
                    >
                      表示
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedWeek ? (
        <div className="weekly-progress-detail">
          <div className="weekly-progress-detail-heading">
            <div>
              <h3>{formatWeekLabel(selectedWeek.start)}の作業内容</h3>
              <p>{formatShortDate(selectedWeek.start)} - {formatShortDate(selectedWeek.end)} / 担当者別</p>
            </div>
            <strong>{detail.totalCount}件</strong>
          </div>
          <div className="weekly-progress-groups">
            {detail.groups.map((group) => (
              <section className="weekly-progress-group" key={group.memberId}>
                <div className="weekly-progress-group-heading">
                  <strong>{group.member?.name ?? "未割当"}</strong>
                  <span>{group.tasks.length}件表示</span>
                </div>
                <div className="weekly-progress-task-list">
                  {group.tasks.map((task) => (
                    <button
                      className="weekly-progress-task"
                      key={`${group.memberId}-${task.id}`}
                      onClick={() => onSelectTask(task.id)}
                      type="button"
                    >
                      <span className={`weekly-progress-task-status ${task.status}`}>
                        {statusLabels[task.status]}
                      </span>
                      <span className="weekly-progress-task-copy">
                        <strong>{task.title}</strong>
                        <small>
                          {formatShortDate(task.start)} - {formatShortDate(task.end)} / {task.progress}%
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {detail.groups.length === 0 ? (
              <div className="weekly-progress-detail-empty">この週にかかるタスクはありません。</div>
            ) : null}
          </div>
          {detail.hiddenCount > 0 ? (
            <small className="weekly-progress-detail-note">
              タスクが多いため、先頭{maxDetailTasks}件を表示しています。対象タスクは全{detail.totalCount}件です。
            </small>
          ) : null}
        </div>
      ) : null}

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

function buildWeeklyTaskGroups(
  week: WeeklyProgressRow,
  tasks: ScheduleTask[],
  members: Member[],
): WeeklyTaskGroup[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const groups = new Map<string, WeeklyTaskGroup>();
  tasks
    .filter((task) => task.start <= week.end && task.end >= week.start)
    .sort((left, right) => {
      const leftPriority = left.status === "delayed" ? 0 : left.status === "inProgress" ? 1 : 2;
      const rightPriority = right.status === "delayed" ? 0 : right.status === "inProgress" ? 1 : 2;
      return leftPriority - rightPriority || left.start.localeCompare(right.start) || left.title.localeCompare(right.title);
    })
    .forEach((task) => {
      const assigneeIds = task.assigneeIds.length > 0 ? task.assigneeIds : [unassignedMemberId];
      assigneeIds.forEach((memberId) => {
        const group = groups.get(memberId) ?? {
          member: memberById.get(memberId) ?? null,
          memberId,
          tasks: [],
        };
        group.tasks.push(task);
        groups.set(memberId, group);
      });
    });
  return [...groups.values()].sort((left, right) => {
    if (left.memberId === unassignedMemberId) return -1;
    if (right.memberId === unassignedMemberId) return 1;
    return (left.member?.name ?? "").localeCompare(right.member?.name ?? "");
  });
}
