import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type {
  Member,
  ProjectIssue,
  ProjectIssuePriority,
  ProjectIssueStatus,
  ProjectIssueType,
  ScheduleTask,
} from "../../../types/schedule";
import {
  issuePriorityLabels,
  issuePriorityOptions,
  issueStatusLabels,
  issueStatusOptions,
  issueTypeLabels,
  issueTypeOptions,
  type IssueDialogState,
} from "../model/projectIssues";

export function IssueEditorDialog({
  dialog,
  members,
  onClose,
  onSave,
  onSelectTask,
  onUpdateIssue,
  taskById,
  tasks,
}: {
  dialog: IssueDialogState;
  members: Member[];
  onClose: () => void;
  onSave: () => void;
  onSelectTask: (taskId: string) => void;
  onUpdateIssue: (patch: Partial<ProjectIssue>) => void;
  taskById: Map<string, ScheduleTask>;
  tasks: ScheduleTask[];
}) {
  const [bodyMode, setBodyMode] = useState<"edit" | "preview">("edit");
  const { issue, mode } = dialog;
  const linkedTask = issue.taskIds[0] ? (taskById.get(issue.taskIds[0]) ?? null) : null;
  const primaryAssigneeId = issue.assigneeIds[0] ?? "";

  return (
    <div className="issue-dialog-overlay" role="presentation">
      <aside aria-label="課題編集" aria-modal="true" className="issue-dialog" role="dialog">
        <div className="issue-detail-heading">
          <div>
            <span>{mode === "create" ? "新規課題" : issueTypeLabels[issue.type]}</span>
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
              {issueStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {issueStatusLabels[status]}
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
              {issuePriorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {issuePriorityLabels[priority]}
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
              {issueTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {issueTypeLabels[type]}
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
                aria-selected={bodyMode === "edit"}
                className={bodyMode === "edit" ? "active" : ""}
                onClick={() => setBodyMode("edit")}
                role="tab"
                type="button"
              >
                編集
              </button>
              <button
                aria-selected={bodyMode === "preview"}
                className={bodyMode === "preview" ? "active" : ""}
                onClick={() => setBodyMode("preview")}
                role="tab"
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
                onUpdateIssue({ assigneeIds: event.target.value ? [event.target.value] : [] })
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
                onUpdateIssue({ taskIds: event.target.value ? [event.target.value] : [] })
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
