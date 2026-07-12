import { ArrowLeftIcon, CheckCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

import { AttachmentPanel } from "../../../components/common/AttachmentPanel";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { Attachment, Member, ProjectIssue, ScheduleTask } from "../../../types/schedule";
import {
  formatAssignees,
  formatDueDate,
  issuePriorityLabels,
  issueTypeLabels,
} from "../model/projectIssues";
import { IssueStatusBadge } from "./IssueBadges";
import { IssueReplySection } from "./IssueReplySection";

export function IssueDetailPage({
  attachments,
  issue,
  memberById,
  onAddReply,
  onAttachmentAdded,
  onAttachmentDeleted,
  onBack,
  onEdit,
  onSelectTask,
  projectId,
  taskById,
}: {
  attachments: Attachment[];
  issue: ProjectIssue;
  memberById: Map<string, Member>;
  onAddReply: (body: string) => void;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onSelectTask: (taskId: string) => void;
  projectId: string;
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

      <AttachmentPanel
        attachments={attachments.filter(
          (attachment) => attachment.ownerType === "issue" && attachment.ownerId === issue.id,
        )}
        onAttachmentAdded={onAttachmentAdded}
        onAttachmentDeleted={onAttachmentDeleted}
        ownerId={issue.id}
        ownerType="issue"
        projectId={projectId}
      />

      <IssueReplySection
        attachments={attachments}
        onAddReply={onAddReply}
        onAttachmentAdded={onAttachmentAdded}
        onAttachmentDeleted={onAttachmentDeleted}
        parentIssueId={issue.id}
        projectId={projectId}
        replies={issue.replies ?? []}
      />
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
        <span>{issuePriorityLabels[issue.priority]}</span>
        <span>{issueTypeLabels[issue.type]}</span>
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
