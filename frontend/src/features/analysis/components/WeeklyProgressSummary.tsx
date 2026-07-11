import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import type {
  Member,
  ProjectIssue,
  ProjectIssuePriority,
  ProjectIssueStatus,
  ScheduleTask,
} from "../../../types/schedule";
import {
  addDays,
  formatShortDate,
  parseDate,
  statusLabels,
  toDateKey,
} from "../../../lib/schedule";

type WeeklyProgressSummaryProps = {
  issues: ProjectIssue[];
  members: Member[];
  onOpenIssues: () => void;
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
const maxVisibleIssues = 40;
const visibleWeekCount = 3;

const issueStatusLabels: Record<ProjectIssueStatus, string> = {
  blocked: "ブロック",
  closed: "クローズ",
  inProgress: "対応中",
  open: "未対応",
  resolved: "解決",
};

const issuePriorityLabels: Record<ProjectIssuePriority, string> = {
  critical: "緊急",
  high: "高",
  low: "低",
  medium: "中",
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
    currentProgress: row.targetCount > 0 ? Math.round(row.currentProgress / row.targetCount) : 0,
  }));
}

/** 選択週までに期限を迎える課題を、未解消と優先度を考慮して並べます。 */
export function getIssuesDueByWeek(issues: ProjectIssue[], weekEnd: string) {
  return issues
    .filter((issue) => issue.dueDate && issue.dueDate <= weekEnd)
    .sort((left, right) => {
      const leftResolved = isIssueResolved(left);
      const rightResolved = isIssueResolved(right);
      if (leftResolved !== rightResolved) return leftResolved ? 1 : -1;
      return (
        (left.dueDate ?? "").localeCompare(right.dueDate ?? "") ||
        getIssuePriorityOrder(left.priority) - getIssuePriorityOrder(right.priority)
      );
    });
}

/** 週次の完了状況を、期間の長い案件でも読みやすく表示します。 */
export function WeeklyProgressSummary({
  issues,
  members,
  onOpenIssues,
  onSelectTask,
  projectEnd,
  projectStart,
  tasks,
  todayKey,
}: WeeklyProgressSummaryProps) {
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [weekWindowStart, setWeekWindowStart] = useState<number | null>(null);
  const rows = useMemo(
    () => buildWeeklyProgressRows(tasks, projectStart, projectEnd),
    [projectEnd, projectStart, tasks],
  );
  const actionableTasks = useMemo(() => tasks.filter((task) => task.type === "task"), [tasks]);
  const currentWeek = useMemo(() => {
    const matched = rows.find((row) => row.start <= todayKey && todayKey <= row.end);
    if (matched) return matched;
    return todayKey < projectStart ? rows[0] : rows[rows.length - 1];
  }, [projectStart, rows, todayKey]);
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
  const totalCompleted = actionableTasks.filter((task) => task.status === "done").length;
  const totalIncomplete = actionableTasks.length - totalCompleted;
  const delayedCount = actionableTasks.filter((task) => task.status === "delayed").length;
  const actualCompletionRate =
    actionableTasks.length > 0 ? Math.round((totalCompleted / actionableTasks.length) * 100) : 0;
  const plannedCompletionCount = currentWeek
    ? rows
        .filter((row) => row.weekKey <= currentWeek.weekKey)
        .reduce((sum, row) => sum + row.planned, 0)
    : 0;
  const plannedCompletionRate =
    actionableTasks.length > 0
      ? Math.round((plannedCompletionCount / actionableTasks.length) * 100)
      : 0;
  const completionGap = actualCompletionRate - plannedCompletionRate;
  const detail = useMemo(() => {
    if (!selectedWeek) return { groups: [], hiddenCount: 0, totalCount: 0 };
    const groups = buildWeeklyTaskGroups(selectedWeek, actionableTasks, members);
    const totalCount = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id))).size;
    let remaining = maxDetailTasks;
    const visibleGroups = groups
      .map((group) => {
        const visibleTasks = group.tasks.slice(0, Math.min(group.tasks.length, remaining));
        remaining -= visibleTasks.length;
        return { ...group, tasks: visibleTasks };
      })
      .filter((group) => group.tasks.length > 0);
    return {
      groups: visibleGroups,
      hiddenCount: Math.max(totalCount - (maxDetailTasks - remaining), 0),
      totalCount,
    };
  }, [actionableTasks, members, selectedWeek]);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const selectedWeekIssues = useMemo(() => {
    if (!selectedWeek) return [];
    return getIssuesDueByWeek(issues, selectedWeek.end);
  }, [issues, selectedWeek]);
  const unresolvedIssueCount = selectedWeekIssues.filter((issue) => !isIssueResolved(issue)).length;
  const resolvedIssueCount = selectedWeekIssues.length - unresolvedIssueCount;

  useEffect(() => {
    setSelectedWeekKey(null);
    setWeekWindowStart(null);
  }, [projectEnd, projectStart]);

  return (
    <section className="dashboard-panel weekly-progress-panel" aria-label="週次進捗サマリー">
      <div className="weekly-progress-heading">
        <div>
          <h2>週次進捗サマリー</h2>
          <p>予定終了週ごとに、完了・進行中・遅延の状況を集計しています。</p>
        </div>
        <div className="weekly-progress-meta">
          <strong>全{rows.length}週</strong>
          <span>
            現在 {currentWeekIndex + 1}週目 / 完了 {totalCompleted}件 / 遅延 {delayedCount}件
          </span>
        </div>
      </div>

      <div className="weekly-progress-overview" aria-label="プロジェクト全体の計画と実績">
        <div>
          <span>全タスク</span>
          <strong>{actionableTasks.length}件</strong>
        </div>
        <div>
          <span>
            {currentWeek ? `${formatWeekLabel(currentWeek.start)}までの計画完了` : "計画完了"}
          </span>
          <strong>{plannedCompletionCount}件</strong>
        </div>
        <div>
          <span>完了済み</span>
          <strong>{totalCompleted}件</strong>
        </div>
        <div>
          <span>未完了</span>
          <strong>{totalIncomplete}件</strong>
        </div>
        <div>
          <span>全体完了率</span>
          <strong>{actualCompletionRate}%</strong>
        </div>
        <div className={completionGap < 0 ? "behind" : completionGap > 0 ? "ahead" : "on-track"}>
          <span>計画との差</span>
          <strong>
            {completionGap > 0 ? "+" : ""}
            {completionGap}pt
          </strong>
        </div>
      </div>

      <div className="weekly-progress-navigation" aria-label="表示する週の切り替え">
        <div>
          <span>表示中</span>
          <strong>
            {activeWeekWindowStart + 1} -{" "}
            {Math.min(activeWeekWindowStart + visibleWeekCount, rows.length)}週目
          </strong>
        </div>
        <div className="weekly-progress-navigation-actions">
          <button
            aria-label="前の3週を表示"
            disabled={activeWeekWindowStart === 0}
            onClick={() => {
              const nextStart = clampNumber(
                activeWeekWindowStart - visibleWeekCount,
                0,
                maxWeekWindowStart,
              );
              setWeekWindowStart(nextStart);
              setSelectedWeekKey(rows[Math.min(nextStart + 1, rows.length - 1)]?.weekKey ?? null);
            }}
            title="前の3週"
            type="button"
          >
            <ChevronLeftIcon />
          </button>
          <button
            className="weekly-progress-current-week"
            onClick={() => {
              setWeekWindowStart(defaultWeekWindowStart);
              setSelectedWeekKey(currentWeek?.weekKey ?? null);
            }}
            type="button"
          >
            今週へ
          </button>
          <button
            aria-label="次の3週を表示"
            disabled={activeWeekWindowStart >= maxWeekWindowStart}
            onClick={() => {
              const nextStart = clampNumber(
                activeWeekWindowStart + visibleWeekCount,
                0,
                maxWeekWindowStart,
              );
              setWeekWindowStart(nextStart);
              setSelectedWeekKey(rows[Math.min(nextStart + 1, rows.length - 1)]?.weekKey ?? null);
            }}
            title="次の3週"
            type="button"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="weekly-progress-table-wrap">
        <table className="weekly-progress-table">
          <thead>
            <tr>
              <th scope="col">週</th>
              <th scope="col">対象タスク</th>
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
              const completionRate =
                row.planned > 0 ? Math.round((row.completed / row.planned) * 100) : 0;
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
                    <small>
                      {row.start.slice(5).replace("-", "/")} - {row.end.slice(5).replace("-", "/")}
                    </small>
                  </th>
                  <td>{row.targetCount}件</td>
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
              <p>
                {formatShortDate(selectedWeek.start)} - {formatShortDate(selectedWeek.end)} /
                担当者別
              </p>
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
                          {formatShortDate(task.start)} - {formatShortDate(task.end)} /{" "}
                          {task.progress}%
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
              タスクが多いため、先頭{maxDetailTasks}件を表示しています。対象タスクは全
              {detail.totalCount}件です。
            </small>
          ) : null}
        </div>
      ) : null}

      {selectedWeek ? (
        <div className="weekly-progress-issues">
          <div className="weekly-progress-issues-heading">
            <div>
              <h3>{formatWeekLabel(selectedWeek.start)}までに解消予定の課題</h3>
              <p>
                期限が{formatShortDate(selectedWeek.end)}以前の課題を、持ち越しも含めて表示します。
              </p>
            </div>
            <div className="weekly-progress-issues-summary">
              <span>
                未解消 <strong>{unresolvedIssueCount}件</strong>
              </span>
              <span>解消済み {resolvedIssueCount}件</span>
              <button onClick={onOpenIssues} type="button">
                課題一覧へ
              </button>
            </div>
          </div>
          <div className="weekly-progress-issue-list">
            {selectedWeekIssues.slice(0, maxVisibleIssues).map((issue) => {
              const resolved = isIssueResolved(issue);
              const carriedOver =
                !resolved && Boolean(issue.dueDate && issue.dueDate < selectedWeek.start);
              return (
                <div
                  className={`weekly-progress-issue-row ${resolved ? "resolved" : "unresolved"}`}
                  key={issue.id}
                >
                  <div className="weekly-progress-issue-badges">
                    <span className={`priority ${issue.priority}`}>
                      {issuePriorityLabels[issue.priority]}
                    </span>
                    <span className={`status ${issue.status}`}>
                      {issueStatusLabels[issue.status]}
                    </span>
                    {carriedOver ? <span className="carry-over">持ち越し</span> : null}
                  </div>
                  <div className="weekly-progress-issue-copy">
                    <strong>{issue.title}</strong>
                    <small>
                      {formatIssueAssignees(issue, memberById)} / 関連タスク {issue.taskIds.length}
                      件
                    </small>
                  </div>
                  <span className="weekly-progress-issue-due">
                    期限 {formatShortDate(issue.dueDate ?? selectedWeek.end)}
                  </span>
                </div>
              );
            })}
            {selectedWeekIssues.length === 0 ? (
              <div className="weekly-progress-detail-empty">
                この週までに期限を迎える課題はありません。
              </div>
            ) : null}
          </div>
          {selectedWeekIssues.length > maxVisibleIssues ? (
            <small className="weekly-progress-detail-note">
              先頭{maxVisibleIssues}件を表示しています。全{selectedWeekIssues.length}
              件は課題一覧で確認できます。
            </small>
          ) : null}
        </div>
      ) : null}

      <small className="weekly-progress-note">
        対象タスクは、その週に作業期間が重なるタスクの件数です。週別の完了率は、その週に終了予定のタスクのうち完了済みの割合です。
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
      return (
        leftPriority - rightPriority ||
        left.start.localeCompare(right.start) ||
        left.title.localeCompare(right.title)
      );
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

function isIssueResolved(issue: ProjectIssue) {
  return issue.status === "resolved" || issue.status === "closed";
}

function getIssuePriorityOrder(priority: ProjectIssuePriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}

function formatIssueAssignees(issue: ProjectIssue, memberById: Map<string, Member>) {
  if (issue.assigneeIds.length === 0) return "担当未設定";
  return issue.assigneeIds
    .map((memberId) => memberById.get(memberId)?.name ?? "不明な担当者")
    .join(" / ");
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
