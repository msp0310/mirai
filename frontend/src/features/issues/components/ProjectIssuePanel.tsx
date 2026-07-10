import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import type { AuthUser } from "../../../data/authRepository";
import type {
  Member,
  Project,
  ProjectIssue,
  ProjectIssuePriority,
  ProjectIssueReply,
  ProjectIssueStatus,
  ProjectIssueType,
  ScheduleTask,
} from "../../../types/schedule";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";

type ProjectIssuePanelProps = {
  issues: ProjectIssue[];
  members: Member[];
  currentUser: AuthUser;
  onCreateIssue: (issue: Partial<ProjectIssue>) => string;
  onSelectTask: (taskId: string) => void;
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void;
  project: Project;
  tasks: ScheduleTask[];
};

type IssueDialogState = {
  issue: ProjectIssue;
  mode: "create" | "edit";
};

const statusLabels: Record<ProjectIssueStatus, string> = {
  blocked: "ブロック",
  closed: "クローズ",
  inProgress: "対応中",
  open: "未対応",
  resolved: "解決",
};

const priorityLabels: Record<ProjectIssuePriority, string> = {
  critical: "緊急",
  high: "高",
  low: "低",
  medium: "中",
};

const typeLabels: Record<ProjectIssueType, string> = {
  bug: "不具合",
  change: "変更",
  question: "確認",
  risk: "リスク",
  task: "作業",
};

const statusOptions = Object.keys(statusLabels) as ProjectIssueStatus[];
const priorityOptions = Object.keys(priorityLabels) as ProjectIssuePriority[];
const typeOptions = Object.keys(typeLabels) as ProjectIssueType[];

/** プロジェクトに紐づく課題の一覧と更新操作を提供します。 */
export function ProjectIssuePanel({
  issues,
  members,
  currentUser,
  onCreateIssue,
  onSelectTask,
  onUpdateIssue,
  project,
  tasks,
}: ProjectIssuePanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectIssueStatus | "all">("all");
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<IssueDialogState | null>(null);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        if (statusFilter !== "all" && issue.status !== statusFilter) return false;
        if (!normalizedQuery) return true;
        const assigneeNames = issue.assigneeIds
          .map((memberId) => memberById.get(memberId)?.name ?? memberId)
          .join(" ");
        const taskNames = issue.taskIds
          .map((taskId) => taskById.get(taskId)?.title ?? taskId)
          .join(" ");
        const replyText = (issue.replies ?? [])
          .map((reply) => `${reply.authorName} ${reply.body}`)
          .join(" ");
        return `${issue.title} ${issue.body} ${replyText} ${assigneeNames} ${taskNames}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [issues, memberById, normalizedQuery, statusFilter, taskById],
  );
  const openIssues = issues.filter(
    (issue) => issue.status !== "closed" && issue.status !== "resolved",
  );
  const criticalIssues = openIssues.filter(
    (issue) => issue.priority === "critical" || issue.priority === "high",
  );
  const blockedIssues = openIssues.filter((issue) => issue.status === "blocked");
  const dueIssues = openIssues.filter((issue) => issue.dueDate);
  const detailIssue = detailIssueId
    ? (issues.find((issue) => issue.id === detailIssueId) ?? null)
    : null;

  function openCreateDialog() {
    setDialogState({
      issue: createBlankIssueDraft(),
      mode: "create",
    });
    setStatusFilter("all");
  }

  function openEditDialog(issue: ProjectIssue) {
    setDialogState({
      issue: cloneIssue(issue),
      mode: "edit",
    });
  }

  function updateDialogIssue(patch: Partial<ProjectIssue>) {
    setDialogState((current) =>
      current
        ? {
            ...current,
            issue: {
              ...current.issue,
              ...patch,
            },
          }
        : current,
    );
  }

  function addIssueReply(issueId: string, body: string) {
    const issue = issues.find((current) => current.id === issueId);
    if (!issue) return;
    const now = new Date().toISOString();
    const reply: ProjectIssueReply = {
      authorId: currentUser.id,
      authorName: currentUser.name,
      body: body.trim(),
      createdAt: now,
      id: `reply-${Date.now().toString(36)}-${Math.round(Math.random() * 999)}`,
    };
    const replies = [...(issue.replies ?? []), reply];
    const patch: Partial<ProjectIssue> = { replies, updatedAt: now };
    onUpdateIssue(issueId, patch);
  }

  function saveDialogIssue() {
    if (!dialogState) return;
    const issue = normalizeIssueDraft(dialogState.issue);
    if (dialogState.mode === "create") {
      const issueId = onCreateIssue(issue);
      setDetailIssueId(issueId);
      setDialogState(null);
      return;
    }
    onUpdateIssue(issue.id, issue);
    setDialogState(null);
  }

  return (
    <section className="issue-panel" aria-label="課題管理">
      <div className="issue-header">
        <div>
          <span>{project.workspace}</span>
          <h2>課題管理</h2>
        </div>
        <button className="issue-add-button" onClick={openCreateDialog} type="button">
          <PlusIcon />
          課題追加
        </button>
      </div>

      {detailIssue ? (
        <IssueDetailPage
          issue={detailIssue}
          memberById={memberById}
          onAddReply={(body) => addIssueReply(detailIssue.id, body)}
          onBack={() => setDetailIssueId(null)}
          onEdit={() => openEditDialog(detailIssue)}
          onSelectTask={onSelectTask}
          taskById={taskById}
        />
      ) : (
        <>
          <div className="issue-summary">
            <IssueStat label="未解決" tone="info" value={`${openIssues.length}件`} />
            <IssueStat label="高優先度" tone="danger" value={`${criticalIssues.length}件`} />
            <IssueStat label="ブロック" tone="warning" value={`${blockedIssues.length}件`} />
            <IssueStat label="期限設定" tone="neutral" value={`${dueIssues.length}件`} />
          </div>

          <div className="issue-layout">
            <div className="issue-table-card">
              <div className="issue-toolbar">
                <label className="issue-search">
                  <MagnifyingGlassIcon />
                  <input
                    aria-label="課題検索"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="課題・担当・関連タスクを検索"
                    value={query}
                  />
                </label>
                <select
                  aria-label="課題ステータス"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ProjectIssueStatus | "all")
                  }
                  value={statusFilter}
                >
                  <option value="all">すべて</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
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
                    {filteredIssues.map((issue) => {
                      const linkedTask = issue.taskIds[0] ? taskById.get(issue.taskIds[0]) : null;
                      return (
                        <tr
                          className={issue.id === detailIssueId ? "active" : ""}
                          key={issue.id}
                          onClick={() => setDetailIssueId(issue.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setDetailIssueId(issue.id);
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
                              {priorityLabels[issue.priority]}
                            </span>
                          </td>
                          <td>{typeLabels[issue.type]}</td>
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
                                openEditDialog(issue);
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
                {filteredIssues.length === 0 ? (
                  <div className="issue-empty">
                    <strong>該当する課題はありません</strong>
                    <span>条件を変更するか、新しい課題を追加してください。</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
      {dialogState ? (
        <IssueDialog
          issue={dialogState.issue}
          members={members}
          mode={dialogState.mode}
          onClose={() => setDialogState(null)}
          onSave={saveDialogIssue}
          onSelectTask={onSelectTask}
          onUpdateIssue={updateDialogIssue}
          taskById={taskById}
          tasks={tasks}
        />
      ) : null}
    </section>
  );
}

function IssueDialog({
  issue,
  members,
  mode,
  onClose,
  onSave,
  onSelectTask,
  onUpdateIssue,
  taskById,
  tasks,
}: {
  issue: ProjectIssue;
  members: Member[];
  mode: "create" | "edit";
  onClose: () => void;
  onSave: () => void;
  onSelectTask: (taskId: string) => void;
  onUpdateIssue: (patch: Partial<ProjectIssue>) => void;
  taskById: Map<string, ScheduleTask>;
  tasks: ScheduleTask[];
}) {
  const [bodyMode, setBodyMode] = useState<"edit" | "preview">("edit");
  const linkedTask = issue.taskIds[0] ? (taskById.get(issue.taskIds[0]) ?? null) : null;
  const primaryAssigneeId = issue.assigneeIds[0] ?? "";

  return (
    <div className="issue-dialog-overlay" role="presentation">
      <aside aria-label="課題編集" className="issue-dialog" role="dialog">
        <div className="issue-detail-heading">
          <div>
            <span>{mode === "create" ? "新規課題" : typeLabels[issue.type]}</span>
            <strong>{mode === "create" ? "課題を追加" : issue.id}</strong>
          </div>
          <button
            aria-label="閉じる"
            className="issue-dialog-close"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon />
          </button>
        </div>

        <label className="issue-field full">
          課題名
          <input
            onChange={(event) => onUpdateIssue({ title: event.target.value })}
            value={issue.title}
          />
        </label>

        <div className="issue-field-grid">
          <label className="issue-field">
            状態
            <select
              onChange={(event) =>
                onUpdateIssue({ status: event.target.value as ProjectIssueStatus })
              }
              value={issue.status}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="issue-field">
            優先度
            <select
              onChange={(event) =>
                onUpdateIssue({ priority: event.target.value as ProjectIssuePriority })
              }
              value={issue.priority}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="issue-field">
            種別
            <select
              onChange={(event) => onUpdateIssue({ type: event.target.value as ProjectIssueType })}
              value={issue.type}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="issue-field">
            期限
            <input
              onChange={(event) => onUpdateIssue({ dueDate: event.target.value || undefined })}
              type="date"
              value={issue.dueDate ?? ""}
            />
          </label>
        </div>

        <section className="issue-markdown-field">
          <div className="issue-markdown-heading">
            <span>内容</span>
            <div className="issue-markdown-tabs" role="tablist">
              <button
                className={bodyMode === "edit" ? "active" : ""}
                onClick={() => setBodyMode("edit")}
                type="button"
              >
                編集
              </button>
              <button
                className={bodyMode === "preview" ? "active" : ""}
                onClick={() => setBodyMode("preview")}
                type="button"
              >
                プレビュー
              </button>
            </div>
          </div>
          {bodyMode === "edit" ? (
            <textarea
              className="issue-markdown-editor"
              onChange={(event) => onUpdateIssue({ body: event.target.value })}
              placeholder="経緯、確認事項、対応案を記入"
              rows={12}
              value={issue.body}
            />
          ) : (
            <div className="issue-markdown-preview">
              {issue.body.trim() ? (
                <MarkdownPreview content={issue.body} />
              ) : (
                <span className="issue-muted">内容は未入力です</span>
              )}
            </div>
          )}
        </section>

        <div className="issue-field-grid">
          <label className="issue-field">
            担当者
            <select
              onChange={(event) =>
                onUpdateIssue({
                  assigneeIds: event.target.value ? [event.target.value] : [],
                })
              }
              value={primaryAssigneeId}
            >
              <option value="">未設定</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.initials} {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="issue-field">
            関連タスク
            <select
              onChange={(event) =>
                onUpdateIssue({
                  taskIds: event.target.value ? [event.target.value] : [],
                })
              }
              value={issue.taskIds[0] ?? ""}
            >
              <option value="">未設定</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {linkedTask && mode === "edit" ? (
          <button
            className="issue-linked-task"
            onClick={() => onSelectTask(linkedTask.id)}
            type="button"
          >
            <CheckCircleIcon />
            <span>
              ガントで確認
              <strong>{linkedTask.title}</strong>
            </span>
          </button>
        ) : null}

        <div className="issue-dialog-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            キャンセル
          </button>
          <button className="issue-add-button" onClick={onSave} type="button">
            {mode === "create" ? "追加" : "保存"}
          </button>
        </div>
      </aside>
    </div>
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

function IssueDetailPage({
  issue,
  memberById,
  onAddReply,
  onBack,
  onEdit,
  onSelectTask,
  taskById,
}: {
  issue: ProjectIssue;
  memberById: Map<string, Member>;
  onAddReply: (body: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onSelectTask: (taskId: string) => void;
  taskById: Map<string, ScheduleTask>;
}) {
  const linkedTask = issue.taskIds[0] ? (taskById.get(issue.taskIds[0]) ?? null) : null;

  return (
    <article className="issue-detail-page">
      <header className="issue-detail-page-header">
        <button className="issue-back-button" onClick={onBack} type="button">
          <ArrowLeftIcon />
          一覧へ戻る
        </button>
        <button className="issue-edit-button" onClick={onEdit} type="button">
          <PencilSquareIcon />
          編集
        </button>
      </header>

      <IssueReadView
        assigneeLabel={formatAssignees(issue.assigneeIds, memberById)}
        issue={issue}
        linkedTask={linkedTask}
        onSelectTask={onSelectTask}
      />

      <IssueReplySection onAddReply={onAddReply} replies={issue.replies ?? []} />
    </article>
  );
}

function IssueReadView({
  assigneeLabel,
  issue,
  linkedTask,
  onSelectTask,
}: {
  assigneeLabel: string;
  issue: ProjectIssue;
  linkedTask: ScheduleTask | null;
  onSelectTask: (taskId: string) => void;
}) {
  return (
    <section className="issue-read-view">
      <div className="issue-read-title">
        <h3>{issue.title}</h3>
        <IssueStatusBadge status={issue.status} />
      </div>
      <div className="issue-read-meta">
        <span>{priorityLabels[issue.priority]}</span>
        <span>{typeLabels[issue.type]}</span>
        <span>担当 {assigneeLabel}</span>
        <span>期限 {formatDueDate(issue.dueDate)}</span>
      </div>
      <div className="issue-markdown-preview issue-markdown-preview-display">
        {issue.body.trim() ? (
          <MarkdownPreview content={issue.body} />
        ) : (
          <span className="issue-muted">内容は未入力です</span>
        )}
      </div>
      {linkedTask ? (
        <button
          className="issue-linked-task"
          onClick={() => onSelectTask(linkedTask.id)}
          type="button"
        >
          <CheckCircleIcon />
          <span>
            ガントで確認
            <strong>{linkedTask.title}</strong>
          </span>
        </button>
      ) : null}
    </section>
  );
}

function IssueReplySection({
  onAddReply,
  replies,
}: {
  onAddReply: (body: string) => void;
  replies: ProjectIssueReply[];
}) {
  const [replyBody, setReplyBody] = useState("");
  const [replyMode, setReplyMode] = useState<"edit" | "preview">("edit");

  function submitReply() {
    const trimmedBody = replyBody.trim();
    if (!trimmedBody) return;
    onAddReply(trimmedBody);
    setReplyBody("");
    setReplyMode("edit");
  }

  return (
    <section className="issue-reply-section">
      <div className="issue-reply-heading">
        <div>
          <ChatBubbleLeftRightIcon />
          <strong>返信</strong>
          <span>{replies.length}件</span>
        </div>
      </div>

      <div className="issue-reply-list">
        {replies.length > 0 ? (
          replies.map((reply) => (
            <article className="issue-reply" key={reply.id}>
              <div className="issue-reply-avatar">{getInitialLetters(reply.authorName)}</div>
              <div>
                <header>
                  <strong>{reply.authorName}</strong>
                  <span>{formatDateTime(reply.createdAt)}</span>
                </header>
                <div className="issue-markdown-preview issue-reply-body">
                  <MarkdownPreview content={reply.body} />
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="issue-reply-empty">返信はまだありません。</div>
        )}
      </div>

      <div className="issue-reply-editor">
        <div className="issue-markdown-heading">
          <span>返信を追加</span>
          <div className="issue-reply-editor-actions">
            <div className="issue-markdown-tabs" role="tablist">
              <button
                className={replyMode === "edit" ? "active" : ""}
                onClick={() => setReplyMode("edit")}
                type="button"
              >
                編集
              </button>
              <button
                className={replyMode === "preview" ? "active" : ""}
                onClick={() => setReplyMode("preview")}
                type="button"
              >
                プレビュー
              </button>
            </div>
            <button
              className="issue-reply-submit"
              disabled={!replyBody.trim()}
              onClick={submitReply}
              type="button"
            >
              返信を追加
            </button>
          </div>
        </div>
        {replyMode === "edit" ? (
          <textarea
            className="issue-reply-textarea"
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder="返信をMarkdownで入力"
            rows={5}
            value={replyBody}
          />
        ) : (
          <div className="issue-markdown-preview issue-reply-preview">
            {replyBody.trim() ? (
              <MarkdownPreview content={replyBody} />
            ) : (
              <span className="issue-muted">返信内容は未入力です</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function IssueStatusBadge({ status }: { status: ProjectIssueStatus }) {
  return <span className={`issue-status-badge ${status}`}>{statusLabels[status]}</span>;
}

function formatAssignees(ids: string[], memberById: Map<string, Member>) {
  if (ids.length === 0) return "未設定";
  return ids.map((id) => memberById.get(id)?.initials ?? id).join(" / ");
}

function formatDueDate(dueDate: string | undefined) {
  if (!dueDate) return "未設定";
  const [, month, day] = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!month || !day) return dueDate;
  return `${Number(month)}/${Number(day)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function getInitialLetters(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "--";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function createBlankIssueDraft(): ProjectIssue {
  const now = new Date().toISOString();
  return {
    assigneeIds: [],
    body: "",
    createdAt: now,
    github: { syncStatus: "unlinked" },
    id: "issue-draft",
    priority: "medium",
    replies: [],
    status: "open",
    taskIds: [],
    title: "",
    type: "task",
    updatedAt: now,
  };
}

function cloneIssue(issue: ProjectIssue): ProjectIssue {
  return {
    ...issue,
    assigneeIds: [...issue.assigneeIds],
    github: issue.github ? { ...issue.github } : { syncStatus: "unlinked" },
    replies: [...(issue.replies ?? [])],
    taskIds: [...issue.taskIds],
  };
}

function normalizeIssueDraft(issue: ProjectIssue): ProjectIssue {
  return {
    ...issue,
    assigneeIds: [...issue.assigneeIds],
    body: issue.body.trim(),
    dueDate: issue.dueDate || undefined,
    github: issue.github ?? { syncStatus: "unlinked" },
    replies: [...(issue.replies ?? [])],
    taskIds: [...issue.taskIds],
    title: issue.title.trim() || "新しい課題",
  };
}
