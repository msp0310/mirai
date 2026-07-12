import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

import { AttachmentPanel } from "../../../components/common/AttachmentPanel";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { AuthUser } from "../../../data/authRepository";
import type {
  Attachment,
  Member,
  Project,
  ProjectIssue,
  ProjectWorkLog,
  ScheduleTask,
  WorkLogCategory,
} from "../../../types/schedule";

type WorkLogPanelProps = {
  attachments: Attachment[];
  currentUser: AuthUser;
  issues: ProjectIssue[];
  members: Member[];
  onCreateWorkLog: (workLog: Partial<ProjectWorkLog>) => string;
  onDeleteWorkLog: (workLogId: string) => void;
  onSelectTask: (taskId: string) => void;
  onUpdateWorkLog: (workLogId: string, patch: Partial<ProjectWorkLog>) => void;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  project: Project;
  tasks: ScheduleTask[];
  workLogs: ProjectWorkLog[];
};

type WorkLogEditorState = {
  mode: "create" | "edit";
  workLog: ProjectWorkLog;
};

const workLogCategoryLabels: Record<WorkLogCategory, string> = {
  improvement: "改善",
  incident: "障害",
  maintenance: "保守",
  meeting: "会議",
  other: "その他",
  support: "問い合わせ",
};

const workLogCategoryOptions = Object.keys(workLogCategoryLabels) as WorkLogCategory[];

/** 運用保守を含むプロジェクト作業時間の記録を管理します。 */
export function WorkLogPanel({
  attachments,
  currentUser,
  issues,
  members,
  onCreateWorkLog,
  onDeleteWorkLog,
  onSelectTask,
  onUpdateWorkLog,
  onAttachmentAdded,
  onAttachmentDeleted,
  project,
  tasks,
  workLogs,
}: WorkLogPanelProps) {
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<WorkLogCategory | "all">("all");
  const [detailWorkLogId, setDetailWorkLogId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<WorkLogEditorState | null>(null);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const issueById = useMemo(() => new Map(issues.map((issue) => [issue.id, issue])), [issues]);
  const monthOptions = useMemo(() => buildMonthOptions(workLogs), [workLogs]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredWorkLogs = useMemo(
    () =>
      [...workLogs]
        .filter((log) => {
          if (memberFilter !== "all" && log.memberId !== memberFilter) {
            return false;
          }
          if (monthFilter !== "all" && !log.date.startsWith(monthFilter)) {
            return false;
          }
          if (categoryFilter !== "all" && log.category !== categoryFilter) {
            return false;
          }
          if (!normalizedQuery) {
            return true;
          }
          const memberName = memberById.get(log.memberId)?.name ?? "";
          const taskTitle = log.taskId ? (taskById.get(log.taskId)?.title ?? "") : "";
          const issueTitle = log.issueId ? (issueById.get(log.issueId)?.title ?? "") : "";
          return `${log.summary} ${log.note ?? ""} ${memberName} ${taskTitle} ${issueTitle}`
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((a, b) => `${b.date}${b.updatedAt}`.localeCompare(`${a.date}${a.updatedAt}`)),
    [
      categoryFilter,
      issueById,
      memberById,
      memberFilter,
      monthFilter,
      normalizedQuery,
      taskById,
      workLogs,
    ],
  );
  const totalHours = sumHours(filteredWorkLogs);
  const operationHours = sumHours(
    filteredWorkLogs.filter(
      (log) =>
        log.category === "maintenance" || log.category === "support" || log.category === "incident",
    ),
  );
  const activeMemberCount = new Set(filteredWorkLogs.map((log) => log.memberId)).size;
  const detailWorkLog = detailWorkLogId
    ? (workLogs.find((workLog) => workLog.id === detailWorkLogId) ?? null)
    : null;

  function openCreatePage() {
    setEditorState({
      mode: "create",
      workLog: createBlankWorkLogDraft(members, currentUser),
    });
  }

  function openEditPage(workLog: ProjectWorkLog) {
    setEditorState({
      mode: "edit",
      workLog: { ...workLog },
    });
  }

  function updateEditorWorkLog(patch: Partial<ProjectWorkLog>) {
    setEditorState((current) =>
      current
        ? {
            ...current,
            workLog: {
              ...current.workLog,
              ...patch,
            },
          }
        : current,
    );
  }

  function saveEditorWorkLog() {
    if (!editorState) {
      return;
    }
    const workLog = normalizeWorkLogDraft(editorState.workLog);
    if (editorState.mode === "create") {
      const createdId = onCreateWorkLog(workLog);
      setDetailWorkLogId(createdId);
    } else {
      onUpdateWorkLog(workLog.id, workLog);
      setDetailWorkLogId(workLog.id);
    }
    setEditorState(null);
  }

  function deleteWorkLog(workLogId: string) {
    onDeleteWorkLog(workLogId);
    if (detailWorkLogId === workLogId) {
      setDetailWorkLogId(null);
    }
  }

  if (editorState) {
    return (
      <WorkLogEditorPage
        issues={issues}
        members={members}
        mode={editorState.mode}
        onBack={() => setEditorState(null)}
        onSave={saveEditorWorkLog}
        onUpdate={updateEditorWorkLog}
        project={project}
        tasks={tasks}
        workLog={editorState.workLog}
      />
    );
  }

  if (detailWorkLog) {
    return (
      <WorkLogDetailPage
        issue={detailWorkLog.issueId ? (issueById.get(detailWorkLog.issueId) ?? null) : null}
        member={memberById.get(detailWorkLog.memberId) ?? null}
        onBack={() => setDetailWorkLogId(null)}
        onDelete={() => deleteWorkLog(detailWorkLog.id)}
        onEdit={() => openEditPage(detailWorkLog)}
        attachments={attachments.filter(
          (attachment) =>
            attachment.ownerType === "workLog" && attachment.ownerId === detailWorkLog.id,
        )}
        onAttachmentAdded={onAttachmentAdded}
        onAttachmentDeleted={onAttachmentDeleted}
        onSelectTask={onSelectTask}
        project={project}
        task={detailWorkLog.taskId ? (taskById.get(detailWorkLog.taskId) ?? null) : null}
        workLog={detailWorkLog}
      />
    );
  }

  return (
    <section className="worklog-panel" aria-label="作業時間">
      <div className="worklog-header">
        <div>
          <span>{project.workspace}</span>
          <h2>作業時間</h2>
        </div>
        <button className="worklog-add-button" onClick={openCreatePage} type="button">
          <PlusIcon />
          時間を記録
        </button>
      </div>

      <div className="worklog-summary">
        <WorkLogStat label="表示中合計" value={formatHours(totalHours)} />
        <WorkLogStat label="保守系" value={formatHours(operationHours)} />
        <WorkLogStat label="担当者" value={`${activeMemberCount}名`} />
      </div>

      <div className="worklog-table-card">
        <div className="worklog-toolbar">
          <label className="worklog-search">
            <MagnifyingGlassIcon />
            <input
              aria-label="作業時間検索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="内容・担当・タスク・課題を検索"
              value={query}
            />
          </label>
          <select
            aria-label="作業月"
            onChange={(event) => setMonthFilter(event.target.value)}
            value={monthFilter}
          >
            <option value="all">すべての月</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
          <select
            aria-label="担当者"
            onChange={(event) => setMemberFilter(event.target.value)}
            value={memberFilter}
          >
            <option value="all">すべての担当</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <select
            aria-label="分類"
            onChange={(event) => setCategoryFilter(event.target.value as WorkLogCategory | "all")}
            value={categoryFilter}
          >
            <option value="all">すべての分類</option>
            {workLogCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {workLogCategoryLabels[category]}
              </option>
            ))}
          </select>
        </div>

        <div className="worklog-table-scroll">
          <table className="worklog-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>担当</th>
                <th>分類</th>
                <th>時間</th>
                <th>内容</th>
                <th>紐付け</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkLogs.map((log) => {
                const linkedTask = log.taskId ? (taskById.get(log.taskId) ?? null) : null;
                const linkedIssue = log.issueId ? (issueById.get(log.issueId) ?? null) : null;
                return (
                  <tr key={log.id}>
                    <td>{formatShortDate(log.date)}</td>
                    <td>{memberById.get(log.memberId)?.initials ?? log.memberId}</td>
                    <td>
                      <span className={`worklog-category-badge ${log.category}`}>
                        {workLogCategoryLabels[log.category]}
                      </span>
                    </td>
                    <td className="worklog-hours-cell">{formatHours(log.hours)}</td>
                    <td className="worklog-summary-cell">
                      <button
                        className="worklog-summary-button"
                        onClick={() => setDetailWorkLogId(log.id)}
                        type="button"
                      >
                        <strong>{log.summary}</strong>
                        {log.note ? <small>Markdownメモあり</small> : null}
                      </button>
                    </td>
                    <td className="worklog-link-cell">
                      {linkedTask ? (
                        <button onClick={() => onSelectTask(linkedTask.id)} type="button">
                          {linkedTask.title}
                        </button>
                      ) : linkedIssue ? (
                        <span>{linkedIssue.title}</span>
                      ) : (
                        <span className="worklog-muted">未設定</span>
                      )}
                    </td>
                    <td>
                      <div className="worklog-row-actions">
                        <button
                          aria-label={`${log.summary} を編集`}
                          onClick={() => openEditPage(log)}
                          type="button"
                        >
                          <PencilSquareIcon />
                        </button>
                        <button
                          aria-label={`${log.summary} を削除`}
                          className="danger"
                          onClick={() => deleteWorkLog(log.id)}
                          type="button"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredWorkLogs.length === 0 ? (
            <div className="worklog-empty">
              <WrenchScrewdriverIcon />
              <strong>作業時間の記録はありません</strong>
              <span>保守対応、問い合わせ、障害調査などの実績を登録できます。</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function WorkLogDetailPage({
  attachments,
  issue,
  member,
  onBack,
  onDelete,
  onEdit,
  onAttachmentAdded,
  onAttachmentDeleted,
  onSelectTask,
  project,
  task,
  workLog,
}: {
  attachments: Attachment[];
  issue: ProjectIssue | null;
  member: Member | null;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  onSelectTask: (taskId: string) => void;
  project: Project;
  task: ScheduleTask | null;
  workLog: ProjectWorkLog;
}) {
  return (
    <article className="worklog-detail-page">
      <header className="worklog-detail-page-header">
        <button className="issue-back-button" onClick={onBack} type="button">
          <ArrowLeftIcon />
          一覧へ戻る
        </button>
        <div>
          <button className="issue-edit-button" onClick={onEdit} type="button">
            <PencilSquareIcon />
            編集
          </button>
          <button className="worklog-delete-button" onClick={onDelete} type="button">
            <TrashIcon />
            削除
          </button>
        </div>
      </header>

      <section className="worklog-read-view">
        <div className="worklog-read-title">
          <div>
            <span>{project.workspace}</span>
            <h3>{workLog.summary}</h3>
          </div>
          <span className={`worklog-category-badge ${workLog.category}`}>
            {workLogCategoryLabels[workLog.category]}
          </span>
        </div>

        <div className="worklog-read-meta">
          <span>{formatLongDate(workLog.date)}</span>
          <span>{formatHours(workLog.hours)}</span>
          <span>{member ? `${member.initials} ${member.name}` : workLog.memberId}</span>
          <span>更新 {formatDateTime(workLog.updatedAt)}</span>
        </div>

        <div className="worklog-link-summary">
          {task ? (
            <button onClick={() => onSelectTask(task.id)} type="button">
              <CheckCircleIcon />
              <span>
                関連タスク
                <strong>{task.title}</strong>
              </span>
            </button>
          ) : null}
          {issue ? (
            <div>
              <ClockIcon />
              <span>
                関連課題
                <strong>{issue.title}</strong>
              </span>
            </div>
          ) : null}
          {!task && !issue ? (
            <span className="worklog-muted">関連タスク・課題は未設定です</span>
          ) : null}
        </div>

        <section className="worklog-note-section">
          <h4>対応内容</h4>
          <div className="issue-markdown-preview issue-markdown-preview-display worklog-note-preview">
            {workLog.note?.trim() ? (
              <MarkdownPreview content={workLog.note} />
            ) : (
              <span className="issue-muted">対応内容は未入力です</span>
            )}
          </div>
        </section>
        <AttachmentPanel
          attachments={attachments}
          onAttachmentAdded={onAttachmentAdded}
          onAttachmentDeleted={onAttachmentDeleted}
          ownerId={workLog.id}
          ownerType="workLog"
          projectId={project.id}
        />
      </section>
    </article>
  );
}

function WorkLogEditorPage({
  issues,
  members,
  mode,
  onBack,
  onSave,
  onUpdate,
  project,
  tasks,
  workLog,
}: {
  issues: ProjectIssue[];
  members: Member[];
  mode: "create" | "edit";
  onBack: () => void;
  onSave: () => void;
  onUpdate: (patch: Partial<ProjectWorkLog>) => void;
  project: Project;
  tasks: ScheduleTask[];
  workLog: ProjectWorkLog;
}) {
  const [noteMode, setNoteMode] = useState<"edit" | "preview">("edit");

  return (
    <article className="worklog-editor-page">
      <header className="worklog-detail-page-header">
        <button className="issue-back-button" onClick={onBack} type="button">
          <ArrowLeftIcon />
          一覧へ戻る
        </button>
        <button className="worklog-add-button" onClick={onSave} type="button">
          {mode === "create" ? "記録する" : "保存"}
        </button>
      </header>

      <div className="worklog-editor-heading">
        <span>{project.workspace}</span>
        <h2>{mode === "create" ? "作業時間を記録" : "作業時間を編集"}</h2>
      </div>

      <div className="worklog-editor-layout">
        <section className="worklog-editor-main">
          <label className="worklog-field">
            内容
            <input
              onChange={(event) => onUpdate({ summary: event.target.value })}
              placeholder="例: 月次データ取込エラーの調査"
              value={workLog.summary}
            />
          </label>

          <section className="issue-markdown-field worklog-markdown-field">
            <div className="issue-markdown-heading">
              <span>対応内容</span>
              <div className="issue-markdown-tabs" role="tablist">
                <button
                  className={noteMode === "edit" ? "active" : ""}
                  onClick={() => setNoteMode("edit")}
                  type="button"
                >
                  編集
                </button>
                <button
                  className={noteMode === "preview" ? "active" : ""}
                  onClick={() => setNoteMode("preview")}
                  type="button"
                >
                  プレビュー
                </button>
              </div>
            </div>
            {noteMode === "edit" ? (
              <textarea
                className="issue-markdown-editor worklog-markdown-editor"
                onChange={(event) => onUpdate({ note: event.target.value })}
                placeholder={"## 対応内容\n- 事象\n- 対応\n- 次回確認"}
                value={workLog.note ?? ""}
              />
            ) : (
              <div className="issue-markdown-preview worklog-markdown-preview">
                {workLog.note?.trim() ? (
                  <MarkdownPreview content={workLog.note} />
                ) : (
                  <span className="issue-muted">対応内容は未入力です</span>
                )}
              </div>
            )}
          </section>
        </section>

        <aside className="worklog-editor-side">
          <label className="worklog-field">
            日付
            <input
              onChange={(event) => onUpdate({ date: event.target.value })}
              type="date"
              value={workLog.date}
            />
          </label>
          <label className="worklog-field">
            時間
            <input
              min="0"
              onChange={(event) => onUpdate({ hours: Number(event.target.value) })}
              step="0.25"
              type="number"
              value={workLog.hours}
            />
          </label>
          <label className="worklog-field">
            担当者
            <select
              onChange={(event) => onUpdate({ memberId: event.target.value })}
              value={workLog.memberId}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.initials} {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="worklog-field">
            分類
            <select
              onChange={(event) => onUpdate({ category: event.target.value as WorkLogCategory })}
              value={workLog.category}
            >
              {workLogCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {workLogCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="worklog-field">
            関連タスク
            <select
              onChange={(event) => onUpdate({ taskId: event.target.value || undefined })}
              value={workLog.taskId ?? ""}
            >
              <option value="">未設定</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="worklog-field">
            関連課題
            <select
              onChange={(event) => onUpdate({ issueId: event.target.value || undefined })}
              value={workLog.issueId ?? ""}
            >
              <option value="">未設定</option>
              {issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.title}
                </option>
              ))}
            </select>
          </label>
        </aside>
      </div>
    </article>
  );
}

function WorkLogStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="worklog-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function createBlankWorkLogDraft(members: Member[], currentUser: AuthUser): ProjectWorkLog {
  const now = new Date().toISOString();
  return {
    billable: true,
    category: "maintenance",
    createdAt: now,
    createdBy: currentUser.name,
    date: now.slice(0, 10),
    hours: 1,
    id: "worklog-draft",
    memberId: members[0]?.id ?? "",
    summary: "",
    updatedAt: now,
  };
}

function normalizeWorkLogDraft(workLog: ProjectWorkLog): ProjectWorkLog {
  return {
    ...workLog,
    hours: Number.isFinite(workLog.hours) ? Math.max(workLog.hours, 0) : 0,
    issueId: workLog.issueId || undefined,
    note: workLog.note?.trim() || undefined,
    summary: workLog.summary.trim() || "運用保守対応",
    taskId: workLog.taskId || undefined,
  };
}

function buildMonthOptions(workLogs: ProjectWorkLog[]) {
  return [...new Set(workLogs.map((log) => log.date.slice(0, 7)))].toSorted().toReversed();
}

function sumHours(workLogs: ProjectWorkLog[]) {
  return workLogs.reduce((total, log) => total + log.hours, 0);
}

function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function formatShortDate(date: string) {
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!year || !month || !day) {
    return date;
  }
  return `${year}/${Number(month)}/${Number(day)}`;
}

function formatLongDate(date: string) {
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!year || !month || !day) {
    return date;
  }
  return `${year}/${Number(month)}/${Number(day)}`;
}

function formatMonth(month: string) {
  const [, year, monthValue] = month.match(/^(\d{4})-(\d{2})$/) ?? [];
  if (!year || !monthValue) {
    return month;
  }
  return `${year}年${Number(monthValue)}月`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
