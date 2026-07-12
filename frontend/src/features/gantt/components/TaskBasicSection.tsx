import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { MemberChecklist } from "../../../components/ui/MemberChecklist";
import {
  addDays,
  daysInclusive,
  formatShortDate,
  getWorkingDaySpan,
  isWorkingDay,
  parseDate,
  statusLabels,
  toDateKey,
} from "../../../lib/schedule";
import { normalizeProgressStatus } from "../../../lib/taskOperations";
import type { CalendarDefinition, Member, ScheduleTask } from "../../../types/schedule";
import {
  buildAdjustedAssigneeAllocations,
  buildEqualAssigneeAllocations,
} from "../lib/taskAssigneeAllocations";
import { AssigneeAllocationEditor } from "./AssigneeAllocationEditor";

type TaskBasicSectionProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  members: Member[];
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSetTaskDates: (taskId: string, patch: Partial<Pick<ScheduleTask, "end" | "start">>) => void;
  onTaskActivity: (taskId: string, title: string, detail: string, tone?: "info") => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  task: ScheduleTask;
};

/** タスク名、日程、基準計画、進捗、担当者配分を編集します。 */
export function TaskBasicSection({
  calendar,
  calendarAware,
  members,
  onMoveTask,
  onResizeTask,
  onSetTaskDates,
  onTaskActivity,
  onUpdateTask,
  task,
}: TaskBasicSectionProps) {
  const workingDays = getWorkingDaySpan(task.start, task.end, calendar, calendarAware);
  const calendarDays = daysInclusive(task.start, task.end);
  const canEdit = task.type !== "summary" && task.type !== "phase";
  const startIsNonWorking =
    canEdit && calendarAware && !isWorkingDay(parseDate(task.start), calendar, true);
  const endIsNonWorking =
    canEdit &&
    calendarAware &&
    task.end !== task.start &&
    !isWorkingDay(parseDate(task.end), calendar, true);
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const baseline =
    task.baselineStart && task.baselineEnd
      ? {
          capturedAt: task.baselineCapturedAt,
          end: task.baselineEnd,
          endDelta: getDateDiffDays(task.baselineEnd, task.end),
          start: task.baselineStart,
          startDelta: getDateDiffDays(task.baselineStart, task.start),
        }
      : null;

  function toggleAssignee(memberId: string) {
    const exists = task.assigneeIds.includes(memberId);
    const next = exists
      ? task.assigneeIds.filter((id) => id !== memberId)
      : [...task.assigneeIds, memberId];
    const assigneeIds = next.length > 0 ? next : [memberId];
    onUpdateTask(task.id, {
      assigneeAllocations: buildEqualAssigneeAllocations(assigneeIds),
      assigneeIds,
    });
  }

  function moveStartToWorkingDay() {
    const start = getNextWorkingDateOnOrAfter(task.start, calendar, calendarAware);
    onUpdateTask(task.id, { start });
    onTaskActivity(
      task.id,
      "開始日を稼働日に調整しました",
      `${formatShortDate(task.start)} から ${formatShortDate(start)} へ移動しました。`,
      "info",
    );
  }

  function moveEndToWorkingDay() {
    const end = getPreviousWorkingDateOnOrBefore(task.end, calendar, calendarAware);
    onSetTaskDates(task.id, { end });
    onTaskActivity(
      task.id,
      "終了日を稼働日に調整しました",
      `${formatShortDate(task.end)} から ${formatShortDate(end)} へ調整しました。`,
      "info",
    );
  }

  return (
    <>
      <label className="field-stack">
        タスク名
        <input
          data-task-focus-target="title"
          value={task.title}
          onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
        />
      </label>
      <label className="field-stack">
        作業メモ
        <textarea
          data-task-focus-target="description"
          disabled={!canEdit}
          onChange={(event) => onUpdateTask(task.id, { description: event.target.value })}
          placeholder="前提、顧客確認事項、実装メモなど"
          value={task.description ?? ""}
        />
      </label>
      <div className="inspector-grid">
        <span>期間</span>
        <strong>
          {formatShortDate(task.start)} - {formatShortDate(task.end)}
        </strong>
        <span>実働日数</span>
        <strong>{workingDays}日</strong>
        <span>暦日数</span>
        <strong>{calendarDays}日</strong>
        <span>状態</span>
        <strong>{statusLabels[task.status]}</strong>
        <span>進捗</span>
        <strong>{task.progress}%</strong>
        <span>担当</span>
        <div className="assignee-list">
          {assignees.map((member) => (
            <span key={member.id}>{member.initials}</span>
          ))}
        </div>
      </div>
      <section className="baseline-summary" data-task-focus-target="baseline" tabIndex={-1}>
        <div>
          <span>基準計画</span>
          {baseline?.capturedAt ? <small>{formatDateTimeLabel(baseline.capturedAt)}</small> : null}
        </div>
        {baseline ? (
          <>
            <strong>
              {formatShortDate(baseline.start)} - {formatShortDate(baseline.end)}
            </strong>
            <div className="baseline-delta-grid">
              <span>開始</span>
              <em className={getDeltaToneClass(baseline.startDelta)}>
                {formatDeltaDays(baseline.startDelta)}
              </em>
              <span>終了</span>
              <em className={getDeltaToneClass(baseline.endDelta)}>
                {formatDeltaDays(baseline.endDelta)}
              </em>
            </div>
          </>
        ) : (
          <p>分析画面で現在の日程を基準計画として設定できます</p>
        )}
      </section>
      <div className="two-col inspector-fields">
        <label>
          開始日
          <input
            data-task-focus-target="start"
            disabled={!canEdit}
            onChange={(event) => onUpdateTask(task.id, { start: event.target.value })}
            type="date"
            value={task.start}
          />
        </label>
        <label>
          終了日
          <input
            data-task-focus-target="end"
            disabled={!canEdit}
            onChange={(event) => onUpdateTask(task.id, { end: event.target.value })}
            type="date"
            value={task.end}
          />
        </label>
      </div>
      {startIsNonWorking || endIsNonWorking ? (
        <div className="non-working-date-warning">
          {startIsNonWorking ? (
            <div>
              <ExclamationTriangleIcon />
              <span>開始日が非稼働日です</span>
              <button onClick={moveStartToWorkingDay} type="button">
                開始を稼働日に
              </button>
            </div>
          ) : null}
          {endIsNonWorking ? (
            <div>
              <ExclamationTriangleIcon />
              <span>終了日が非稼働日です</span>
              <button onClick={moveEndToWorkingDay} type="button">
                終了を稼働日に
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="date-nudge">
        <button
          disabled={task.type === "summary"}
          onClick={() => onMoveTask(task.id, -1)}
          type="button"
        >
          1日戻す
        </button>
        <button
          disabled={task.type === "summary"}
          onClick={() => onMoveTask(task.id, 1)}
          type="button"
        >
          1日進める
        </button>
        <button
          disabled={task.type !== "task"}
          onClick={() => onResizeTask(task.id, "end", -1)}
          type="button"
        >
          期間短縮
        </button>
        <button
          disabled={task.type !== "task"}
          onClick={() => onResizeTask(task.id, "end", 1)}
          type="button"
        >
          期間延長
        </button>
      </div>
      <div className="two-col inspector-fields">
        <label>
          状態
          <select
            data-task-focus-target="status"
            disabled={!canEdit}
            onChange={(event) =>
              onUpdateTask(task.id, { status: event.target.value as ScheduleTask["status"] })
            }
            value={task.status}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          予定工数
          <input
            data-task-focus-target="effort"
            disabled={task.type !== "task"}
            min="0"
            onChange={(event) =>
              onUpdateTask(task.id, { effortHours: Number(event.target.value) || undefined })
            }
            type="number"
            value={task.effortHours ?? 0}
          />
        </label>
      </div>
      <label className="progress-editor">
        <span>進捗率</span>
        <input
          data-task-focus-target="progress"
          disabled={!canEdit}
          max="100"
          min="0"
          onChange={(event) => {
            const progress = Number(event.target.value);
            onUpdateTask(task.id, { progress, status: normalizeProgressStatus(progress) });
          }}
          type="range"
          value={task.progress}
        />
      </label>
      <MemberChecklist
        disabled={!canEdit}
        focusTarget="assignees"
        members={members}
        onToggle={toggleAssignee}
        selectedIds={task.assigneeIds}
        title="担当者"
      />
      <AssigneeAllocationEditor
        disabled={!canEdit}
        members={assignees}
        onChange={(memberId, percent) =>
          onUpdateTask(task.id, {
            assigneeAllocations: buildAdjustedAssigneeAllocations(task, memberId, percent),
          })
        }
        task={task}
      />
    </>
  );
}

function getDateDiffDays(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

function getNextWorkingDateOnOrAfter(
  dateKey: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
) {
  let date = parseDate(dateKey);
  if (!calendarAware) {
    return toDateKey(date);
  }
  while (!isWorkingDay(date, calendar, true)) {
    date = addDays(date, 1);
  }
  return toDateKey(date);
}

function getPreviousWorkingDateOnOrBefore(
  dateKey: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
) {
  let date = parseDate(dateKey);
  if (!calendarAware) {
    return toDateKey(date);
  }
  while (!isWorkingDay(date, calendar, true)) {
    date = addDays(date, -1);
  }
  return toDateKey(date);
}

function formatDeltaDays(delta: number) {
  if (delta === 0) {
    return "差分なし";
  }
  return `${Math.abs(delta)}日${delta > 0 ? "遅れ" : "前倒し"}`;
}

function getDeltaToneClass(delta: number) {
  if (delta > 0) {
    return "delayed";
  }
  if (delta < 0) {
    return "ahead";
  }
  return "same";
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}
