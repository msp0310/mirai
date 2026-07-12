import { MagnifyingGlassIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

import type {
  Member,
  ProjectIssue,
  ProjectIssueStatus,
  ScheduleTask,
} from "../../../types/schedule";
import {
  formatAssignees,
  formatDueDate,
  issuePriorityLabels,
  issueStatusLabels,
  issueStatusOptions,
  issueTypeLabels,
} from "../model/projectIssues";
import { IssueStatusBadge } from "./IssueBadges";

export function IssueListView({
  issues,
  memberById,
  onEdit,
  onOpenDetail,
  onQueryChange,
  onSelectTask,
  onStatusFilterChange,
  query,
  stats,
  statusFilter,
  taskById,
}: {
  issues: ProjectIssue[];
  memberById: Map<string, Member>;
  onEdit: (issue: ProjectIssue) => void;
  onOpenDetail: (issueId: string) => void;
  onQueryChange: (query: string) => void;
  onSelectTask: (taskId: string) => void;
  onStatusFilterChange: (status: ProjectIssueStatus | "all") => void;
  query: string;
  stats: { blocked: number; critical: number; due: number; open: number };
  statusFilter: ProjectIssueStatus | "all";
  taskById: Map<string, ScheduleTask>;
}) {
  return (
    <>
      <div className="issue-summary">
        <IssueStat label="未解決" tone="info" value={`${stats.open}件`} />
        <IssueStat label="高優先度" tone="danger" value={`${stats.critical}件`} />
        <IssueStat label="ブロック" tone="warning" value={`${stats.blocked}件`} />
        <IssueStat label="期限設定" tone="neutral" value={`${stats.due}件`} />
      </div>

      <div className="issue-layout">
        <div className="issue-table-card">
          <div className="issue-toolbar">
            <label className="issue-search">
              <MagnifyingGlassIcon />
              <input
                aria-label="課題検索"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="課題・担当・関連タスクを検索"
                value={query}
              />
            </label>
            <select
              aria-label="課題ステータス"
              onChange={(event) =>
                onStatusFilterChange(event.target.value as ProjectIssueStatus | "all")
              }
              value={statusFilter}
            >
              <option value="all">すべて</option>
              {issueStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {issueStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="issue-table-scroll">
            <table className="issue-table">
              <thead>
                <tr>
                  <th>状態</th>
                  <th>優先度</th>
                  <th>種別</th>
                  <th>課題</th>
                  <th>担当</th>
                  <th>関連タスク</th>
                  <th>返信</th>
                  <th>期限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => {
                  const linkedTask = issue.taskIds[0] ? taskById.get(issue.taskIds[0]) : null;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => onOpenDetail(issue.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenDetail(issue.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td>
                        <IssueStatusBadge status={issue.status} />
                      </td>
                      <td>
                        <span className={`issue-priority-badge ${issue.priority}`}>
                          {issuePriorityLabels[issue.priority]}
                        </span>
                      </td>
                      <td>{issueTypeLabels[issue.type]}</td>
                      <td className="issue-title-cell">
                        <strong>{issue.title}</strong>
                        <small>{issue.body || issue.id}</small>
                      </td>
                      <td>{formatAssignees(issue.assigneeIds, memberById)}</td>
                      <td>
                        {linkedTask ? (
                          <button
                            className="issue-table-task-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectTask(linkedTask.id);
                            }}
                            type="button"
                          >
                            {linkedTask.title}
                          </button>
                        ) : (
                          <span className="issue-muted">未設定</span>
                        )}
                      </td>
                      <td>{issue.replies?.length ?? 0}</td>
                      <td>{formatDueDate(issue.dueDate)}</td>
                      <td>
                        <button
                          className="issue-edit-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(issue);
                          }}
                          type="button"
                        >
                          <PencilSquareIcon />
                          編集
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {issues.length === 0 ? (
              <div className="issue-empty">
                <strong>該当する課題はありません</strong>
                <span>条件を変更するか、新しい課題を追加してください。</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function IssueStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "info" | "neutral" | "warning";
  value: string;
}) {
  return (
    <article className={`issue-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
