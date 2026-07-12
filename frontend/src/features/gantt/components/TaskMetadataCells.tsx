import { useEffect, useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";
import { getAssignableMembers } from "../../../lib/members";
import { formatShortDate, statusLabels } from "../../../lib/schedule";
import { normalizeProgressStatus } from "../../../lib/taskOperations";
import type { GanttColumnVisibility, Member, ScheduleTask, TaskRow } from "../../../types/schedule";
import { getTaskSelectionOptions } from "../utils/taskSelection";

type TaskMetadataCellsProps = {
  columnVisibility: GanttColumnVisibility;
  members: Member[];
  onSelect: (options?: { additive?: boolean; range?: boolean }) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  showDates: boolean;
  task: TaskRow;
};

/** 日付、担当、状態、進捗の編集セルをタスク行本体から分離します。 */
export function TaskMetadataCells({
  columnVisibility,
  members,
  onSelect,
  onUpdateTask,
  showDates,
  task,
}: TaskMetadataCellsProps) {
  const [progressDraft, setProgressDraft] = useState(String(task.progress));
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const assigneeOptions = getAssignableMembers(members, task.assigneeIds);
  const canEditFields = task.type !== "summary" && task.type !== "phase";

  useEffect(() => setProgressDraft(String(task.progress)), [task.progress]);

  function commitProgress(value: string) {
    const numericValue = Number(value);
    const progress = Number.isFinite(numericValue)
      ? Math.min(Math.max(Math.round(numericValue), 0), 100)
      : task.progress;
    setProgressDraft(String(progress));
    if (progress !== task.progress) {
      onUpdateTask(task.id, { progress, status: normalizeProgressStatus(progress) });
    }
  }

  return (
    <>
      {showDates ? (
        <>
          <span className="task-date-cell">{formatShortDate(task.start)}</span>
          <span className="task-date-cell">{formatShortDate(task.end)}</span>
        </>
      ) : null}
      {showDates ? (
        <span
          className="table-assignee-cell"
          title={assignees.map((member) => member.name).join(" / ") || "担当者未設定"}
        >
          {assignees.length > 0 ? assignees.map((member) => member.name).join(" / ") : "未設定"}
        </span>
      ) : columnVisibility.assignee ? (
        <span className="avatar-group">
          {canEditFields ? (
            <select
              aria-label={`${task.title} の担当者`}
              className="inline-select assignee-select"
              onChange={(event) =>
                onUpdateTask(task.id, {
                  assigneeAllocations: undefined,
                  assigneeIds: [event.target.value],
                })
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect(getTaskSelectionOptions(event));
              }}
              onFocus={() => onSelect()}
              value={task.assigneeIds[0] ?? members[0]?.id ?? ""}
            >
              {assigneeOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.initials}
                  {member.status === "inactive" ? " 休止" : ""}
                </option>
              ))}
            </select>
          ) : (
            assignees.slice(0, 2).map((member) => <Avatar key={member.id} member={member} />)
          )}
        </span>
      ) : null}
      {columnVisibility.status ? (
        <span className="status-cell">
          {canEditFields ? (
            <select
              aria-label={`${task.title} の状態`}
              className={`inline-select status-select ${task.status}`}
              onChange={(event) =>
                onUpdateTask(task.id, { status: event.target.value as ScheduleTask["status"] })
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect(getTaskSelectionOptions(event));
              }}
              onFocus={() => onSelect()}
              value={task.status}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`status-pill ${task.status}`}>
              <span />
              {statusLabels[task.status]}
            </span>
          )}
        </span>
      ) : null}
      {showDates || columnVisibility.progress ? (
        <span className="progress-cell">
          <span className="progress-track">
            <span style={{ width: `${task.progress}%` }} />
          </span>
          {canEditFields ? (
            <input
              aria-label={`${task.title} の進捗率`}
              className="inline-progress-input"
              max="100"
              min="0"
              onBlur={(event) => commitProgress(event.currentTarget.value)}
              onChange={(event) => setProgressDraft(event.target.value)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(getTaskSelectionOptions(event));
              }}
              onFocus={() => onSelect()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitProgress(event.currentTarget.value);
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.currentTarget.value = String(task.progress);
                  setProgressDraft(String(task.progress));
                  event.currentTarget.blur();
                }
              }}
              type="number"
              value={progressDraft}
            />
          ) : (
            <span className="progress-readonly">{task.progress}%</span>
          )}
        </span>
      ) : null}
    </>
  );
}
