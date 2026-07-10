import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { MemberChecklist } from "../../../components/ui/MemberChecklist";
import { getActiveMembers } from "../../../lib/members";
import type { CreateTaskInput, Member, ScheduleTask } from "../../../types/schedule";

type CreateTaskSheetProps = {
  members: Member[];
  onClose: () => void;
  onCreateTask: (input: CreateTaskInput) => void;
  tasks: ScheduleTask[];
};

/** ガントに追加するタスクの基本情報を入力するシートです。 */
export function CreateTaskSheet({ members, onClose, onCreateTask, tasks }: CreateTaskSheetProps) {
  const parentOptions = tasks.filter((task) => task.type === "phase" || task.type === "summary");
  const [title, setTitle] = useState("新しい作業項目");
  const [parentId, setParentId] = useState(parentOptions[0]?.id ?? "none");
  const [start, setStart] = useState("2025-06-03");
  const [end, setEnd] = useState("2025-06-07");
  const assigneeOptions = useMemo(() => {
    const activeMembers = getActiveMembers(members);
    return activeMembers.length > 0 ? activeMembers : members;
  }, [members]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    assigneeOptions[0] ? [assigneeOptions[0].id] : [],
  );
  const [effortHours, setEffortHours] = useState(40);

  useEffect(() => {
    if (!parentOptions.some((task) => task.id === parentId)) {
      setParentId(parentOptions[0]?.id ?? "none");
    }
  }, [parentOptions, parentId]);

  useEffect(() => {
    setAssigneeIds((current) => {
      const availableIds = new Set(assigneeOptions.map((member) => member.id));
      const next = current.filter((memberId) => availableIds.has(memberId));
      if (next.length > 0) return next;
      return assigneeOptions[0] ? [assigneeOptions[0].id] : [];
    });
  }, [assigneeOptions]);

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) => {
      if (current.includes(memberId)) {
        return current.length > 1
          ? current.filter((selectedId) => selectedId !== memberId)
          : current;
      }
      return [...current, memberId];
    });
  }

  function submit() {
    if (assigneeIds.length === 0) return;
    onCreateTask({
      title,
      parentId: parentId === "none" ? null : parentId,
      start,
      end,
      assigneeIds,
      effortHours,
    });
  }

  return (
    <aside className="create-sheet">
      <div className="panel-heading">
        <strong>タスク追加</strong>
        <button className="close-button" onClick={onClose} aria-label="閉じる" type="button">
          <XMarkIcon />
        </button>
      </div>
      <label>
        タスク名
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        フェーズ
        <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
          {parentOptions.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
      <div className="two-col">
        <label>
          開始日
          <input
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              if (end < event.target.value) setEnd(event.target.value);
            }}
            type="date"
          />
        </label>
        <label>
          終了日
          <input
            min={start}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            type="date"
          />
        </label>
      </div>
      <MemberChecklist
        members={assigneeOptions}
        onToggle={toggleAssignee}
        selectedIds={assigneeIds}
        title="担当者"
      />
      <label>
        予定工数
        <input
          min="0"
          value={effortHours}
          onChange={(event) => setEffortHours(Number(event.target.value))}
          type="number"
        />
      </label>
      <button
        className="primary-button full"
        disabled={assigneeIds.length === 0}
        onClick={submit}
        type="button"
      >
        タスクを追加
      </button>
    </aside>
  );
}
