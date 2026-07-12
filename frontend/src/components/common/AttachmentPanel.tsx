import {
  ArrowDownTrayIcon,
  DocumentIcon,
  PaperClipIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useRef, useState } from "react";

import {
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
} from "../../data/attachmentRepository";
import type { Attachment, AttachmentOwnerType } from "../../types/schedule";

import * as styles from "./AttachmentPanel.css";

type AttachmentPanelProps = {
  attachments: Attachment[];
  ownerId: string;
  ownerType: AttachmentOwnerType;
  parentId?: string;
  projectId: string;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
};

/** 運用データに共通で使うアップロード、ダウンロード、削除UIです。 */
export function AttachmentPanel({
  attachments,
  onAttachmentAdded,
  onAttachmentDeleted,
  ownerId,
  ownerType,
  parentId,
  projectId,
}: AttachmentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const attachment = await uploadAttachment({
          file,
          ownerId,
          ownerType,
          parentId,
          projectId,
        });
        onAttachmentAdded(attachment);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "ファイルを追加できませんでした。",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function removeAttachment(attachment: Attachment) {
    if (!window.confirm(`「${attachment.fileName}」を削除しますか？`)) {
      return;
    }
    setError(null);
    try {
      await deleteAttachment(projectId, attachment.id);
      onAttachmentDeleted(attachment.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "ファイルを削除できませんでした。",
      );
    }
  }

  async function download(attachment: Attachment) {
    setError(null);
    try {
      const blob = await downloadAttachment(attachment);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "ファイルを取得できませんでした。",
      );
    }
  }

  return (
    <section className={styles.panel} aria-label="添付ファイル">
      <div className={styles.heading}>
        <span className={styles.headingLabel}>
          <PaperClipIcon className={styles.headingIcon} />
          添付ファイル
        </span>
        <span className={styles.count}>{attachments.length}件</span>
      </div>
      <label
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""} ${busy ? styles.dropzoneDisabled : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles([...event.dataTransfer.files]);
        }}
      >
        <input
          ref={inputRef}
          disabled={busy}
          hidden
          multiple
          onChange={(event) => void uploadFiles([...(event.target.files ?? [])])}
          type="file"
        />
        <span>
          <PaperClipIcon className={styles.dropzoneIcon} />
          {busy ? "アップロード中..." : "クリックまたはドラッグ＆ドロップで追加"}
        </span>
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}
      {attachments.length > 0 ? (
        <ul className={styles.list}>
          {attachments.map((attachment) => (
            <li className={styles.item} key={attachment.id}>
              <span className={styles.fileIcon}>
                <DocumentIcon />
              </span>
              <span className={styles.fileInfo}>
                <span className={styles.fileName} title={attachment.fileName}>
                  {attachment.fileName}
                </span>
                <span className={styles.fileMeta}>
                  {formatFileSize(attachment.sizeBytes)} / {attachment.uploadedBy} /{" "}
                  {formatDate(attachment.uploadedAt)}
                </span>
              </span>
              <span className={styles.actions}>
                <button
                  aria-label={`${attachment.fileName}をダウンロード`}
                  className={styles.action}
                  onClick={() => void download(attachment)}
                  title="ダウンロード"
                  type="button"
                >
                  <ArrowDownTrayIcon />
                </button>
                <button
                  aria-label={`${attachment.fileName}を削除`}
                  className={`${styles.action} ${styles.dangerAction}`}
                  onClick={() => void removeAttachment(attachment)}
                  title="削除"
                  type="button"
                >
                  <TrashIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>添付ファイルはありません。</p>
      )}
    </section>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ja-JP");
}
