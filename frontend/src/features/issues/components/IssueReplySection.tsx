import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { AttachmentPanel } from "../../../components/common/AttachmentPanel";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { Attachment, ProjectIssueReply } from "../../../types/schedule";
import { formatDateTime, getInitialLetters } from "../model/projectIssues";

export function IssueReplySection({
  attachments,
  onAddReply,
  onAttachmentAdded,
  onAttachmentDeleted,
  parentIssueId,
  projectId,
  replies,
}: {
  attachments: Attachment[];
  onAddReply: (body: string) => void;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  parentIssueId: string;
  projectId: string;
  replies: ProjectIssueReply[];
}) {
  const [replyBody, setReplyBody] = useState("");
  const [replyMode, setReplyMode] = useState<"edit" | "preview">("edit");

  function submitReply() {
    const trimmedBody = replyBody.trim();
    if (!trimmedBody) {
      return;
    }
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
                <AttachmentPanel
                  attachments={attachments.filter(
                    (attachment) =>
                      attachment.ownerType === "issueReply" && attachment.ownerId === reply.id,
                  )}
                  onAttachmentAdded={onAttachmentAdded}
                  onAttachmentDeleted={onAttachmentDeleted}
                  ownerId={reply.id}
                  ownerType="issueReply"
                  parentId={parentIssueId}
                  projectId={projectId}
                />
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
                aria-selected={replyMode === "edit"}
                className={replyMode === "edit" ? "active" : ""}
                onClick={() => setReplyMode("edit")}
                role="tab"
                type="button"
              >
                編集
              </button>
              <button
                aria-selected={replyMode === "preview"}
                className={replyMode === "preview" ? "active" : ""}
                onClick={() => setReplyMode("preview")}
                role="tab"
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
