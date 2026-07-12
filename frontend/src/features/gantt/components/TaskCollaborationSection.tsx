import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import { AttachmentPanel } from "../../../components/common/AttachmentPanel";
import type { Attachment, ScheduleTask, TaskComment } from "../../../types/schedule";

type TaskCollaborationSectionProps = {
  attachments: Attachment[];
  canComment: boolean;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  onTaskActivity: (taskId: string, title: string, detail: string, tone?: "success") => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  projectId: string;
  task: ScheduleTask;
};

/** コメント入力とタスク・コメントへの添付を管理します。 */
export function TaskCollaborationSection({
  attachments,
  canComment,
  onAttachmentAdded,
  onAttachmentDeleted,
  onTaskActivity,
  onUpdateTask,
  projectId,
  task,
}: TaskCollaborationSectionProps) {
  const [commentText, setCommentText] = useState("");
  const comments = task.comments ?? [];

  useEffect(() => setCommentText(""), [task.id]);

  function addComment() {
    const body = commentText.trim();
    if (!body) {
      return;
    }
    const nextComment: TaskComment = {
      author: "操作ユーザー",
      body,
      createdAt: new Date().toISOString(),
      id: createDetailId(task.id, "comment"),
    };
    onUpdateTask(task.id, { comments: [nextComment, ...comments] });
    setCommentText("");
    onTaskActivity(task.id, "コメントを追加しました", body, "success");
  }

  return (
    <>
      <section className="task-detail-section" data-task-focus-target="comments" tabIndex={-1}>
        <div className="task-detail-heading">
          <span>
            <ChatBubbleLeftRightIcon />
            コメント
          </span>
          <small>{comments.length}件</small>
        </div>
        <textarea
          className="task-comment-input"
          disabled={!canComment || task.type === "summary" || task.type === "phase"}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="進捗メモ、確認結果、次アクションなど"
          value={commentText}
        />
        <button
          className="task-detail-primary"
          disabled={
            !canComment || !commentText.trim() || task.type === "summary" || task.type === "phase"
          }
          onClick={addComment}
          type="button"
        >
          コメント追加
        </button>
        <div className="task-comment-list">
          {comments.slice(0, 4).map((comment) => (
            <article key={comment.id}>
              <div>
                <strong>{comment.author}</strong>
                <span>{formatCommentTime(comment.createdAt)}</span>
              </div>
              <p>{comment.body}</p>
              <AttachmentPanel
                attachments={attachments.filter(
                  (attachment) =>
                    attachment.ownerType === "taskComment" && attachment.ownerId === comment.id,
                )}
                onAttachmentAdded={onAttachmentAdded}
                onAttachmentDeleted={onAttachmentDeleted}
                ownerId={comment.id}
                ownerType="taskComment"
                parentId={task.id}
                projectId={projectId}
              />
            </article>
          ))}
          {comments.length === 0 ? (
            <p className="task-detail-empty">コメントはまだありません</p>
          ) : null}
        </div>
      </section>
      <AttachmentPanel
        attachments={attachments.filter(
          (attachment) => attachment.ownerType === "task" && attachment.ownerId === task.id,
        )}
        onAttachmentAdded={onAttachmentAdded}
        onAttachmentDeleted={onAttachmentDeleted}
        ownerId={task.id}
        ownerType="task"
        projectId={projectId}
      />
    </>
  );
}

function createDetailId(taskId: string, prefix: string) {
  return `${taskId}-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
  }).format(date);
}
