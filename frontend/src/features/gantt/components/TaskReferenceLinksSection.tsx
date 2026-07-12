import { LinkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import type { ScheduleTask, TaskReferenceLink } from "../../../types/schedule";

type TaskReferenceLinksSectionProps = {
  onTaskActivity: (
    taskId: string,
    title: string,
    detail: string,
    tone?: "info" | "warning",
  ) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  task: ScheduleTask;
};

/** タスクに紐づく設計書や外部資料へのリンクを管理します。 */
export function TaskReferenceLinksSection({
  onTaskActivity,
  onUpdateTask,
  task,
}: TaskReferenceLinksSectionProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const links = task.links ?? [];
  const disabled = task.type === "summary" || task.type === "phase";

  useEffect(() => {
    setLabel("");
    setUrl("");
  }, [task.id]);

  function addLink() {
    const normalizedUrl = normalizeUrl(url.trim());
    const nextLabel = label.trim() || normalizedUrl;
    if (!normalizedUrl) {
      return;
    }
    const nextLink: TaskReferenceLink = {
      createdAt: new Date().toISOString(),
      id: `${task.id}-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: nextLabel,
      url: normalizedUrl,
    };
    onUpdateTask(task.id, { links: [nextLink, ...links] });
    setLabel("");
    setUrl("");
    onTaskActivity(task.id, "参考リンクを追加しました", nextLabel, "info");
  }

  function deleteLink(linkId: string) {
    const link = links.find((candidate) => candidate.id === linkId);
    onUpdateTask(task.id, { links: links.filter((candidate) => candidate.id !== linkId) });
    if (link) {
      onTaskActivity(task.id, "参考リンクを削除しました", link.label, "warning");
    }
  }

  return (
    <section className="task-detail-section">
      <div className="task-detail-heading">
        <span>
          <LinkIcon />
          参考リンク
        </span>
        <small>{links.length}件</small>
      </div>
      <div className="task-link-form">
        <input disabled={disabled} onChange={(event) => setLabel(event.target.value)} placeholder="表示名" value={label} />
        <input disabled={disabled} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." value={url} />
        <button disabled={!url.trim() || disabled} onClick={addLink} type="button">
          追加
        </button>
      </div>
      <div className="task-link-list">
        {links.map((link) => (
          <div key={link.id}>
            <a href={link.url} rel="noreferrer" target="_blank">
              {link.label}
            </a>
            <button disabled={disabled} onClick={() => deleteLink(link.id)} title="削除" type="button">
              <TrashIcon />
            </button>
          </div>
        ))}
        {links.length === 0 ? <p className="task-detail-empty">参考リンクは未登録です</p> : null}
      </div>
    </section>
  );
}

function normalizeUrl(value: string) {
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}
