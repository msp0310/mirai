import {
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type {
  CalendarDefinition,
  Member,
  ScheduleTask,
  TaskChecklistItem,
  TaskComment,
  TaskInspectorFocusTarget,
  TaskReferenceLink,
} from "../../../types/schedule";
import {
  addDays,
  daysInclusive,
  formatShortDate,
  getWorkingDaySpan,
  getTaskAssigneeAllocationMap,
  isWorkingDay,
  parseDate,
  statusLabels,
  toDateKey,
} from "../../../lib/schedule";
import { normalizeProgressStatus } from "../../../lib/taskOperations";
import { MemberChecklist } from "../../../components/ui/MemberChecklist";

type TaskInspectorProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  focusRequest: {
    requestId: number;
    target: TaskInspectorFocusTarget;
    taskId: string;
  } | null;
  members: Member[];
  onClose: () => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onTaskActivity: (
    taskId: string,
    title: string,
    detail: string,
    tone?: "danger" | "info" | "success" | "warning",
  ) => void;
  onResizeTask: (taskId: string, edge: "start" | "end", deltaDays: number) => void;
  onSetTaskDates: (taskId: string, patch: Partial<Pick<ScheduleTask, "end" | "start">>) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  tasks: ScheduleTask[];
  task: ScheduleTask | null;
};

/** 選択中タスクの詳細情報と編集項目を表示します。 */
export function TaskInspector({
  calendar,
  calendarAware,
  focusRequest,
  members,
  onClose,
  onMoveTask,
  onTaskActivity,
  onResizeTask,
  onSetTaskDates,
  onUpdateTask,
  tasks,
  task,
}: TaskInspectorProps) {
  const [checklistText, setChecklistText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [dependencyQuery, setDependencyQuery] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const inspectorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setChecklistText("");
    setCommentText("");
    setDependencyQuery("");
    setLinkLabel("");
    setLinkUrl("");
  }, [task?.id]);

  useEffect(() => {
    if (!task || !focusRequest || focusRequest.taskId !== task.id) return;
    const frameId = window.requestAnimationFrame(() => {
      const root = inspectorRef.current;
      if (!root) return;
      const target =
        root.querySelector<HTMLElement>(`[data-task-focus-target="${focusRequest.target}"]`) ??
        root.querySelector<HTMLElement>('[data-task-focus-target="title"]');
      if (!target) return;
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement && target.type === "text") {
        target.select();
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusRequest?.requestId, focusRequest?.target, focusRequest?.taskId, task?.id]);

  if (!task) return null;
  const currentTask = task;
  const workingDays = getWorkingDaySpan(
    currentTask.start,
    currentTask.end,
    calendar,
    calendarAware,
  );
  const calendarDays = daysInclusive(currentTask.start, currentTask.end);
  const canEditDateBoundary = currentTask.type !== "summary" && currentTask.type !== "phase";
  const startIsNonWorking =
    canEditDateBoundary &&
    calendarAware &&
    !isWorkingDay(parseDate(currentTask.start), calendar, true);
  const endIsNonWorking =
    canEditDateBoundary &&
    calendarAware &&
    currentTask.end !== currentTask.start &&
    !isWorkingDay(parseDate(currentTask.end), calendar, true);

  const assignees = currentTask.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const selectedDependencyIds = currentTask.dependencies ?? [];
  const selectedDependencyIdSet = new Set(selectedDependencyIds);
  const dependencyCandidates = getDependencyCandidates(tasks, currentTask);
  const normalizedDependencyQuery = dependencyQuery.trim().toLowerCase();
  const filteredDependencyCandidates = dependencyCandidates
    .filter((candidate) => {
      if (selectedDependencyIdSet.has(candidate.id)) return true;
      if (!normalizedDependencyQuery) return true;
      return (
        candidate.title.toLowerCase().includes(normalizedDependencyQuery) ||
        candidate.id.toLowerCase().includes(normalizedDependencyQuery)
      );
    })
    .sort((a, b) => {
      const aSelected = selectedDependencyIdSet.has(a.id);
      const bSelected = selectedDependencyIdSet.has(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
    });
  const dependencyWarnings = selectedDependencyIds
    .map((dependencyId) => tasks.find((item) => item.id === dependencyId))
    .filter((dependency): dependency is ScheduleTask => Boolean(dependency))
    .map((dependency) => ({
      dateConflict: dependency.end >= currentTask.start,
      dependency,
      incomplete: dependency.status !== "done",
    }))
    .filter((warning) => warning.incomplete || warning.dateConflict);

  const checklist = currentTask.checklist ?? [];
  const doneChecklistCount = checklist.filter((item) => item.done).length;
  const comments = currentTask.comments ?? [];
  const links = currentTask.links ?? [];
  const baseline =
    currentTask.baselineStart && currentTask.baselineEnd
      ? {
          capturedAt: currentTask.baselineCapturedAt,
          end: currentTask.baselineEnd,
          endDelta: getDateDiffDays(currentTask.baselineEnd, currentTask.end),
          start: currentTask.baselineStart,
          startDelta: getDateDiffDays(currentTask.baselineStart, currentTask.start),
        }
      : null;

  function toggleAssignee(memberId: string) {
    const exists = currentTask.assigneeIds.includes(memberId);
    const next = exists
      ? currentTask.assigneeIds.filter((id) => id !== memberId)
      : [...currentTask.assigneeIds, memberId];
    const assigneeIds = next.length > 0 ? next : [memberId];
    onUpdateTask(currentTask.id, {
      assigneeAllocations: buildEqualAssigneeAllocations(assigneeIds),
      assigneeIds,
    });
  }

  function updateAssigneeAllocation(memberId: string, percent: number) {
    onUpdateTask(currentTask.id, {
      assigneeAllocations: buildAdjustedAssigneeAllocations(currentTask, memberId, percent),
    });
  }

  function toggleDependency(dependencyId: string) {
    const dependencies = currentTask.dependencies ?? [];
    const next = dependencies.includes(dependencyId)
      ? dependencies.filter((id) => id !== dependencyId)
      : [...dependencies, dependencyId];
    onUpdateTask(currentTask.id, { dependencies: next });
  }

  function removeDependency(dependencyId: string) {
    const dependency = tasks.find((item) => item.id === dependencyId);
    onUpdateTask(currentTask.id, {
      dependencies: selectedDependencyIds.filter((id) => id !== dependencyId),
    });
    onTaskActivity(
      currentTask.id,
      "前提タスクを外しました",
      dependency ? `${dependency.title} を前提から外しました。` : dependencyId,
      "warning",
    );
  }

  function completeDependency(dependency: ScheduleTask) {
    onUpdateTask(dependency.id, { progress: 100, status: "done" });
    onTaskActivity(
      dependency.id,
      "前提タスクを完了にしました",
      `${currentTask.title} の前提確認から更新しました。`,
      "success",
    );
  }

  function alignAfterBlockingDependencies() {
    const blockingDependencies = dependencyWarnings
      .filter((warning) => warning.dateConflict)
      .map((warning) => warning.dependency);
    const latestDependency = blockingDependencies.sort((a, b) => b.end.localeCompare(a.end))[0];
    if (!latestDependency) return;

    const start = getNextWorkingStartAfter(latestDependency.end, calendar, calendarAware);
    if (currentTask.type === "phase") {
      onMoveTask(currentTask.id, getDateDiffDays(currentTask.start, start));
    } else {
      onUpdateTask(currentTask.id, { start });
    }
    onTaskActivity(
      currentTask.id,
      "前提後ろへ日程を調整しました",
      `${latestDependency.title} の完了後に ${formatShortDate(start)} 開始へ調整しました。`,
      "info",
    );
  }

  function moveStartToWorkingDay() {
    const start = getNextWorkingDateOnOrAfter(currentTask.start, calendar, calendarAware);
    onUpdateTask(currentTask.id, { start });
    onTaskActivity(
      currentTask.id,
      "開始日を稼働日に調整しました",
      `${formatShortDate(currentTask.start)} から ${formatShortDate(start)} へ移動しました。`,
      "info",
    );
  }

  function moveEndToWorkingDay() {
    const end = getPreviousWorkingDateOnOrBefore(currentTask.end, calendar, calendarAware);
    onSetTaskDates(currentTask.id, { end });
    onTaskActivity(
      currentTask.id,
      "終了日を稼働日に調整しました",
      `${formatShortDate(currentTask.end)} から ${formatShortDate(end)} へ調整しました。`,
      "info",
    );
  }

  function addChecklistItem() {
    const label = checklistText.trim();
    if (!label) return;
    const nextItem: TaskChecklistItem = {
      done: false,
      id: createTaskDetailId(currentTask.id, "check"),
      label,
    };
    onUpdateTask(currentTask.id, { checklist: [...checklist, nextItem] });
    setChecklistText("");
    onTaskActivity(currentTask.id, "完了条件を追加しました", label, "info");
  }

  function toggleChecklistItem(itemId: string) {
    const item = checklist.find((candidate) => candidate.id === itemId);
    const next = checklist.map((candidate) =>
      candidate.id === itemId ? { ...candidate, done: !candidate.done } : candidate,
    );
    onUpdateTask(currentTask.id, { checklist: next });
    if (item) {
      onTaskActivity(
        currentTask.id,
        item.done ? "完了条件を未完了に戻しました" : "完了条件を完了しました",
        item.label,
        item.done ? "warning" : "success",
      );
    }
  }

  function deleteChecklistItem(itemId: string) {
    const item = checklist.find((candidate) => candidate.id === itemId);
    onUpdateTask(currentTask.id, {
      checklist: checklist.filter((candidate) => candidate.id !== itemId),
    });
    if (item) {
      onTaskActivity(currentTask.id, "完了条件を削除しました", item.label, "warning");
    }
  }

  function addComment() {
    const body = commentText.trim();
    if (!body) return;
    const nextComment: TaskComment = {
      author: "操作ユーザー",
      body,
      createdAt: new Date().toISOString(),
      id: createTaskDetailId(currentTask.id, "comment"),
    };
    onUpdateTask(currentTask.id, { comments: [nextComment, ...comments] });
    setCommentText("");
    onTaskActivity(currentTask.id, "コメントを追加しました", body, "success");
  }

  function addLink() {
    const url = normalizeUrl(linkUrl.trim());
    const label = linkLabel.trim() || url;
    if (!url) return;
    const nextLink: TaskReferenceLink = {
      createdAt: new Date().toISOString(),
      id: createTaskDetailId(currentTask.id, "link"),
      label,
      url,
    };
    onUpdateTask(currentTask.id, { links: [nextLink, ...links] });
    setLinkLabel("");
    setLinkUrl("");
    onTaskActivity(currentTask.id, "参考リンクを追加しました", label, "info");
  }

  function deleteLink(linkId: string) {
    const link = links.find((candidate) => candidate.id === linkId);
    onUpdateTask(currentTask.id, {
      links: links.filter((candidate) => candidate.id !== linkId),
    });
    if (link) {
      onTaskActivity(currentTask.id, "参考リンクを削除しました", link.label, "warning");
    }
  }

  return (
    <aside className="task-inspector" ref={inspectorRef}>
      <div className="panel-heading">
        <strong>タスク詳細</strong>
        <button className="close-button" onClick={onClose} aria-label="閉じる" type="button">
          <XMarkIcon />
        </button>
      </div>
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
          disabled={task.type === "summary" || task.type === "phase"}
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
          <p>基準計画は分析機能側で扱う想定です</p>
        )}
      </section>
      <div className="two-col inspector-fields">
        <label>
          開始日
          <input
            data-task-focus-target="start"
            disabled={task.type === "summary" || task.type === "phase"}
            onChange={(event) => onUpdateTask(task.id, { start: event.target.value })}
            type="date"
            value={task.start}
          />
        </label>
        <label>
          終了日
          <input
            data-task-focus-target="end"
            disabled={task.type === "summary" || task.type === "phase"}
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
            disabled={task.type === "summary" || task.type === "phase"}
            onChange={(event) =>
              onUpdateTask(task.id, {
                status: event.target.value as ScheduleTask["status"],
              })
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
              onUpdateTask(task.id, {
                effortHours: Number(event.target.value) || undefined,
              })
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
          disabled={task.type === "summary" || task.type === "phase"}
          max="100"
          min="0"
          onChange={(event) => {
            const progress = Number(event.target.value);
            onUpdateTask(task.id, {
              progress,
              status: normalizeProgressStatus(progress),
            });
          }}
          type="range"
          value={task.progress}
        />
      </label>
      <MemberChecklist
        disabled={task.type === "summary" || task.type === "phase"}
        focusTarget="assignees"
        members={members}
        onToggle={toggleAssignee}
        selectedIds={task.assigneeIds}
        title="担当者"
      />
      <AssigneeAllocationEditor
        disabled={task.type === "summary" || task.type === "phase"}
        members={assignees}
        onChange={updateAssigneeAllocation}
        task={currentTask}
      />
      <section className="task-detail-section">
        <div className="task-detail-heading">
          <span>完了条件</span>
          <small>
            {doneChecklistCount} / {checklist.length}
          </small>
        </div>
        <div className="inline-create-control task-detail-create">
          <input
            disabled={task.type === "summary" || task.type === "phase"}
            onChange={(event) => setChecklistText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addChecklistItem();
              }
            }}
            placeholder="例: 顧客レビュー指摘を反映"
            value={checklistText}
          />
          <button
            disabled={task.type === "summary" || task.type === "phase"}
            onClick={addChecklistItem}
            title="完了条件を追加"
            type="button"
          >
            <PlusIcon />
          </button>
        </div>
        <div className="task-checklist">
          {checklist.map((item) => (
            <label className={item.done ? "done" : ""} key={item.id}>
              <input
                checked={item.done}
                disabled={task.type === "summary" || task.type === "phase"}
                onChange={() => toggleChecklistItem(item.id)}
                type="checkbox"
              />
              <span>{item.label}</span>
              <button
                disabled={task.type === "summary" || task.type === "phase"}
                onClick={(event) => {
                  event.preventDefault();
                  deleteChecklistItem(item.id);
                }}
                title="削除"
                type="button"
              >
                <TrashIcon />
              </button>
            </label>
          ))}
          {checklist.length === 0 ? (
            <p className="task-detail-empty">完了条件は未登録です</p>
          ) : null}
        </div>
      </section>
      <div className="check-list dependency-list">
        <div className="dependency-list-heading">
          <span>前提タスク</span>
          <small>
            {selectedDependencyIds.length}件選択 / {filteredDependencyCandidates.length}
            件表示
          </small>
        </div>
        <label className="dependency-search">
          <MagnifyingGlassIcon />
          <input
            data-task-focus-target="dependencies"
            aria-label="前提タスクを検索"
            disabled={task.type === "summary"}
            onChange={(event) => setDependencyQuery(event.target.value)}
            placeholder="タスク名で検索"
            value={dependencyQuery}
          />
        </label>
        {dependencyWarnings.length > 0 ? (
          <div className="dependency-warning-stack">
            {dependencyWarnings.some((warning) => warning.dateConflict) ? (
              <div className="dependency-repair-card">
                <div>
                  <strong>日程競合があります</strong>
                  <small>最も遅い前提タスクの翌稼働日に開始を合わせます</small>
                </div>
                <button
                  disabled={task.type === "summary"}
                  onClick={alignAfterBlockingDependencies}
                  type="button"
                >
                  日程調整
                </button>
              </div>
            ) : null}
            {dependencyWarnings.slice(0, 3).map((warning) => (
              <article
                className={warning.dateConflict ? "dependency-warning" : "dependency-warning muted"}
                key={warning.dependency.id}
              >
                <ExclamationTriangleIcon />
                <div>
                  <span>
                    {warning.dependency.title}
                    {warning.dateConflict
                      ? " はこのタスク開始日以降に完了予定です"
                      : " はまだ完了していません"}
                  </span>
                  <div className="dependency-warning-actions">
                    {warning.incomplete ? (
                      <button
                        disabled={task.type === "summary"}
                        onClick={() => completeDependency(warning.dependency)}
                        type="button"
                      >
                        完了
                      </button>
                    ) : null}
                    <button
                      disabled={task.type === "summary"}
                      onClick={() => removeDependency(warning.dependency.id)}
                      type="button"
                    >
                      外す
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <div className="dependency-candidates">
          {filteredDependencyCandidates.map((candidate) => (
            <label key={candidate.id}>
              <input
                checked={selectedDependencyIdSet.has(candidate.id)}
                disabled={task.type === "summary"}
                onChange={() => toggleDependency(candidate.id)}
                type="checkbox"
              />
              <span>
                <strong>{candidate.title}</strong>
                <small>
                  {formatShortDate(candidate.start)} - {formatShortDate(candidate.end)}
                </small>
              </span>
            </label>
          ))}
        </div>
        {filteredDependencyCandidates.length === 0 ? (
          <p className="dependency-empty">一致する前提タスクがありません</p>
        ) : null}
      </div>
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
          disabled={task.type === "summary" || task.type === "phase"}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="進捗メモ、確認結果、次アクションなど"
          value={commentText}
        />
        <button
          className="task-detail-primary"
          disabled={!commentText.trim() || task.type === "summary" || task.type === "phase"}
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
            </article>
          ))}
          {comments.length === 0 ? (
            <p className="task-detail-empty">コメントはまだありません</p>
          ) : null}
        </div>
      </section>
      <section className="task-detail-section">
        <div className="task-detail-heading">
          <span>
            <LinkIcon />
            参考リンク
          </span>
          <small>{links.length}件</small>
        </div>
        <div className="task-link-form">
          <input
            disabled={task.type === "summary" || task.type === "phase"}
            onChange={(event) => setLinkLabel(event.target.value)}
            placeholder="表示名"
            value={linkLabel}
          />
          <input
            disabled={task.type === "summary" || task.type === "phase"}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://..."
            value={linkUrl}
          />
          <button
            disabled={!linkUrl.trim() || task.type === "summary" || task.type === "phase"}
            onClick={addLink}
            type="button"
          >
            追加
          </button>
        </div>
        <div className="task-link-list">
          {links.map((link) => (
            <div key={link.id}>
              <a href={link.url} rel="noreferrer" target="_blank">
                {link.label}
              </a>
              <button
                disabled={task.type === "summary" || task.type === "phase"}
                onClick={() => deleteLink(link.id)}
                title="削除"
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          {links.length === 0 ? <p className="task-detail-empty">参考リンクは未登録です</p> : null}
        </div>
      </section>
    </aside>
  );
}

function getDependencyCandidates(tasks: ScheduleTask[], currentTask: ScheduleTask): ScheduleTask[] {
  const descendantIds = getDescendantTaskIds(tasks, currentTask.id);
  return tasks.filter(
    (candidate) =>
      candidate.id !== currentTask.id &&
      candidate.type !== "summary" &&
      candidate.type !== "phase" &&
      !descendantIds.has(candidate.id) &&
      !wouldCreateDependencyCycle(tasks, currentTask.id, candidate.id),
  );
}

type AssigneeAllocationEditorProps = {
  disabled: boolean;
  members: Member[];
  onChange: (memberId: string, percent: number) => void;
  task: ScheduleTask;
};

function AssigneeAllocationEditor({
  disabled,
  members,
  onChange,
  task,
}: AssigneeAllocationEditorProps) {
  if (members.length <= 1) return null;
  const allocationMap = getTaskAssigneeAllocationMap(task);
  const total = Math.round(
    members.reduce((sum, member) => sum + (allocationMap.get(member.id) ?? 0), 0),
  );

  return (
    <section
      className="assignee-allocation-editor"
      data-task-focus-target="allocations"
      tabIndex={-1}
    >
      <div className="task-detail-heading">
        <span>担当配分</span>
        <small>{total}%</small>
      </div>
      {members.map((member) => {
        const percent = Math.round(allocationMap.get(member.id) ?? 0);
        const handlePercentChange = (value: string) => {
          onChange(member.id, Number(value) || 0);
        };
        return (
          <label key={member.id}>
            <span>
              <b style={{ "--avatar-color": member.color } as CSSProperties}>{member.initials}</b>
              {member.name}
            </span>
            <input
              disabled={disabled}
              max="100"
              min="0"
              onChange={(event) => handlePercentChange(event.target.value)}
              onInput={(event) => handlePercentChange(event.currentTarget.value)}
              type="range"
              value={percent}
            />
            <span className="allocation-percent-input">
              <input
                aria-label={`${member.name} 配分`}
                disabled={disabled}
                max="100"
                min="0"
                onChange={(event) => handlePercentChange(event.currentTarget.value)}
                onInput={(event) => handlePercentChange(event.currentTarget.value)}
                step="1"
                type="number"
                value={percent}
              />
              <small>%</small>
            </span>
          </label>
        );
      })}
    </section>
  );
}

function buildEqualAssigneeAllocations(assigneeIds: string[]) {
  const ids = [...new Set(assigneeIds)];
  if (ids.length <= 1) return undefined;
  const base = Math.floor(100 / ids.length);
  const remainder = 100 - base * ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    percent: base + (index === ids.length - 1 ? remainder : 0),
  }));
}

function buildAdjustedAssigneeAllocations(task: ScheduleTask, memberId: string, percent: number) {
  const ids = [...new Set(task.assigneeIds)];
  if (ids.length <= 1) return undefined;
  const clamped = Math.min(Math.max(Math.round(percent), 0), 100);
  const currentMap = getTaskAssigneeAllocationMap(task);
  const otherIds = ids.filter((id) => id !== memberId);
  const otherTotal = otherIds.reduce((sum, id) => sum + (currentMap.get(id) ?? 0), 0);
  const remaining = 100 - clamped;
  const rawAllocations = ids.map((id) => {
    if (id === memberId) return { memberId: id, percent: clamped };
    const currentPercent = currentMap.get(id) ?? 0;
    return {
      memberId: id,
      percent:
        otherTotal > 0 ? (currentPercent / otherTotal) * remaining : remaining / otherIds.length,
    };
  });
  return roundAllocationsTo100(rawAllocations);
}

function roundAllocationsTo100(allocations: Array<{ memberId: string; percent: number }>) {
  const rounded = allocations.map((allocation) => {
    const floored = Math.floor(allocation.percent);
    return {
      fractional: allocation.percent - floored,
      memberId: allocation.memberId,
      percent: floored,
    };
  });
  let remainder = 100 - rounded.reduce((sum, allocation) => sum + allocation.percent, 0);
  rounded
    .slice()
    .sort((a, b) => b.fractional - a.fractional)
    .forEach((allocation) => {
      if (remainder <= 0) return;
      allocation.percent += 1;
      remainder -= 1;
    });
  return rounded.map(({ memberId, percent }) => ({ memberId, percent }));
}

function getDescendantTaskIds(tasks: ScheduleTask[], taskId: string): Set<string> {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    tasks
      .filter((task) => task.parentId === parentId)
      .forEach((task) => {
        ids.add(task.id);
        visit(task.id);
      });
  };
  visit(taskId);
  return ids;
}

function wouldCreateDependencyCycle(
  tasks: ScheduleTask[],
  currentTaskId: string,
  candidateId: string,
): boolean {
  return dependencyPathReaches(tasks, candidateId, currentTaskId, new Set());
}

function dependencyPathReaches(
  tasks: ScheduleTask[],
  sourceTaskId: string,
  targetTaskId: string,
  visitedTaskIds: Set<string>,
): boolean {
  if (sourceTaskId === targetTaskId) return true;
  if (visitedTaskIds.has(sourceTaskId)) return false;
  visitedTaskIds.add(sourceTaskId);
  const sourceTask = tasks.find((task) => task.id === sourceTaskId);
  return (sourceTask?.dependencies ?? []).some((dependencyId) =>
    dependencyPathReaches(tasks, dependencyId, targetTaskId, visitedTaskIds),
  );
}

function createTaskDetailId(taskId: string, prefix: string) {
  return `${taskId}-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDateDiffDays(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

function getNextWorkingStartAfter(
  dateKey: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
) {
  let date = addDays(parseDate(dateKey), 1);
  if (!calendarAware) return toDateKey(date);
  while (!isWorkingDay(date, calendar, true)) {
    date = addDays(date, 1);
  }
  return toDateKey(date);
}

function getNextWorkingDateOnOrAfter(
  dateKey: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
) {
  let date = parseDate(dateKey);
  if (!calendarAware) return toDateKey(date);
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
  if (!calendarAware) return toDateKey(date);
  while (!isWorkingDay(date, calendar, true)) {
    date = addDays(date, -1);
  }
  return toDateKey(date);
}

function formatDeltaDays(delta: number) {
  if (delta === 0) return "差分なし";
  return `${Math.abs(delta)}日${delta > 0 ? "遅れ" : "前倒し"}`;
}

function getDeltaToneClass(delta: number) {
  if (delta > 0) return "delayed";
  if (delta < 0) return "ahead";
  return "same";
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeUrl(value: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleString("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}
