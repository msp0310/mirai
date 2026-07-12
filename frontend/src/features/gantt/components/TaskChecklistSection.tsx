import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import type { ScheduleTask, TaskChecklistItem } from "../../../types/schedule";

type TaskChecklistSectionProps = {
  onTaskActivity: (
    taskId: string,
    title: string,
    detail: string,
    tone?: "info" | "success" | "warning",
  ) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  task: ScheduleTask;
};

/** タスクの完了条件と達成状態を管理します。 */
export function TaskChecklistSection({
  onTaskActivity,
  onUpdateTask,
  task,
}: TaskChecklistSectionProps) {
  const [text, setText] = useState("");
  const checklist = task.checklist ?? [];
  const doneCount = checklist.filter((item) => item.done).length;
  const disabled = task.type === "summary" || task.type === "phase";

  useEffect(() => setText(""), [task.id]);

  function addItem() {
    const label = text.trim();
    if (!label) {
      return;
    }
    const item: TaskChecklistItem = {
      done: false,
      id: `${task.id}-check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
    };
    onUpdateTask(task.id, { checklist: [...checklist, item] });
    setText("");
    onTaskActivity(task.id, "完了条件を追加しました", label, "info");
  }

  function toggleItem(itemId: string) {
    const item = checklist.find((candidate) => candidate.id === itemId);
    onUpdateTask(task.id, {
      checklist: checklist.map((candidate) =>
        candidate.id === itemId ? { ...candidate, done: !candidate.done } : candidate,
      ),
    });
    if (item) {
      onTaskActivity(
        task.id,
        item.done ? "完了条件を未完了に戻しました" : "完了条件を完了しました",
        item.label,
        item.done ? "warning" : "success",
      );
    }
  }

  function deleteItem(itemId: string) {
    const item = checklist.find((candidate) => candidate.id === itemId);
    onUpdateTask(task.id, {
      checklist: checklist.filter((candidate) => candidate.id !== itemId),
    });
    if (item) {
      onTaskActivity(task.id, "完了条件を削除しました", item.label, "warning");
    }
  }

  return (
    <section className="task-detail-section">
      <div className="task-detail-heading">
        <span>完了条件</span>
        <small>
          {doneCount} / {checklist.length}
        </small>
      </div>
      <div className="inline-create-control task-detail-create">
        <input
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder="例: 顧客レビュー指摘を反映"
          value={text}
        />
        <button disabled={disabled} onClick={addItem} title="完了条件を追加" type="button">
          <PlusIcon />
        </button>
      </div>
      <div className="task-checklist">
        {checklist.map((item) => (
          <label className={item.done ? "done" : ""} key={item.id}>
            <input
              checked={item.done}
              disabled={disabled}
              onChange={() => toggleItem(item.id)}
              type="checkbox"
            />
            <span>{item.label}</span>
            <button
              disabled={disabled}
              onClick={(event) => {
                event.preventDefault();
                deleteItem(item.id);
              }}
              title="削除"
              type="button"
            >
              <TrashIcon />
            </button>
          </label>
        ))}
        {checklist.length === 0 ? <p className="task-detail-empty">完了条件は未登録です</p> : null}
      </div>
    </section>
  );
}
