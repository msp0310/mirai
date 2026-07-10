import { ArrowLeftIcon, ArrowRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Member, ScheduleTask, TaskStatus } from "../../../types/schedule";
import { statusLabels } from "../../../lib/schedule";

type SelectedTaskSummary = {
  assigneeCount: number;
  editableCount: number;
  effortHours: number;
  rangeEnd: string;
  rangeStart: string;
  totalCount: number;
};

type GanttSelectionStripProps = {
  assigneeOptions: Member[];
  onAssigneeChange: (memberId: string) => void;
  onClearSelection: () => void;
  onDateShift: (deltaDays: number) => void;
  onStatusChange: (status: TaskStatus) => void;
  primaryTask: ScheduleTask | null;
  summary: SelectedTaskSummary | null;
};

const taskTypeLabels: Record<ScheduleTask["type"], string> = {
  milestone: "節目",
  phase: "フェーズ",
  summary: "案件",
  task: "タスク",
};

function formatDateShort(date: string) {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${Number(month)}/${Number(day)}`;
}

/** 選択中タスクに対する一括操作をガント上部に表示します。 */
export function GanttSelectionStrip({
  assigneeOptions,
  onAssigneeChange,
  onClearSelection,
  onDateShift,
  onStatusChange,
  primaryTask,
  summary,
}: GanttSelectionStripProps) {
  if (!summary) return null;

  const canEditSelectedTasks = summary.editableCount > 0;
  const title =
    summary.totalCount === 1 && primaryTask ? primaryTask.title : `${summary.totalCount}件を選択`;
  const rangeLabel = `${formatDateShort(summary.rangeStart)} - ${formatDateShort(
    summary.rangeEnd,
  )}`;
  const primaryStatusLabel = primaryTask ? statusLabels[primaryTask.status] : "一括操作";

  return (
    <div className="gantt-selection-strip" aria-label="選択中のタスク操作">
      <div className="gantt-selection-context">
        <span
          className={`selection-type-badge ${
            primaryTask ? `type-${primaryTask.type}` : "type-multi"
          }`}
        >
          {summary.totalCount === 1 && primaryTask ? taskTypeLabels[primaryTask.type] : "複数"}
        </span>
        <div className="gantt-selection-title">
          <strong>{title}</strong>
          <span>
            {rangeLabel} / 工数{summary.effortHours}h / 担当
            {summary.assigneeCount}名
          </span>
        </div>
        <span
          className={`selection-status-pill ${
            primaryTask ? `status-${primaryTask.status}` : "status-multi"
          }`}
        >
          {primaryStatusLabel}
        </span>
      </div>
      <div className="gantt-selection-actions">
        <button
          disabled={!canEditSelectedTasks}
          onClick={() => onDateShift(-1)}
          title="1日戻す (Alt+←)"
          type="button"
        >
          <ArrowLeftIcon />
          1日前
        </button>
        <button
          disabled={!canEditSelectedTasks}
          onClick={() => onDateShift(1)}
          title="1日進める (Alt+→)"
          type="button"
        >
          <ArrowRightIcon />
          1日後
        </button>
        <select
          aria-label="選択行の状態を変更"
          disabled={!canEditSelectedTasks}
          onChange={(event) => {
            if (!event.target.value) return;
            onStatusChange(event.target.value as TaskStatus);
          }}
          value=""
        >
          <option value="">状態変更</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="選択行の担当者を変更"
          disabled={!canEditSelectedTasks}
          onChange={(event) => {
            if (!event.target.value) return;
            onAssigneeChange(event.target.value);
          }}
          value=""
        >
          <option value="">担当変更</option>
          {assigneeOptions.map((member) => (
            <option key={member.id} value={member.id}>
              {member.initials} {member.name}
            </option>
          ))}
        </select>
        <button
          aria-label="選択を解除"
          className="selection-clear-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClearSelection();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          title="選択を解除 (Esc)"
          type="button"
        >
          <XMarkIcon />
        </button>
      </div>
    </div>
  );
}
