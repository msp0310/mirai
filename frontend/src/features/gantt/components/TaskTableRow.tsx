import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  GanttColumnVisibility,
  Member,
  ScheduleTask,
  TaskInspectorFocusTarget,
  TaskRow,
} from "../../../types/schedule";
import type { DependencyIssue } from "../../../lib/schedule";
import { formatShortDate, statusLabels, taskMatchesQuery } from "../../../lib/schedule";
import { getAssignableMembers } from "../../../lib/members";
import { normalizeProgressStatus } from "../../../lib/taskOperations";
import { Avatar } from "../../../components/ui/Avatar";
import { rowHeight } from "./constants";

type TaskTableRowProps = {
  collapsed: boolean;
  canReorder?: boolean;
  columnVisibility: GanttColumnVisibility;
  dependencyIssues: DependencyIssue[];
  dragReordering: boolean;
  members: Member[];
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDragHandlePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onOpenInspector: () => void;
  onSelect: (options?: {
    additive?: boolean;
    focusTarget?: TaskInspectorFocusTarget;
    range?: boolean;
  }) => void;
  onToggle: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  query: string;
  selected: boolean;
  task: TaskRow;
  titleEditSignal?: number;
  showDates?: boolean;
};

/** ガント左側のタスク行を表示し、名前や進捗の編集を受け付けます。 */
export function TaskTableRow({
  canReorder = true,
  collapsed,
  columnVisibility,
  dependencyIssues,
  dragReordering,
  members,
  onContextMenu,
  onDragHandlePointerDown,
  onOpenInspector,
  onSelect,
  onToggle,
  onUpdateTask,
  query,
  selected,
  task,
  titleEditSignal = 0,
  showDates = false,
}: TaskTableRowProps) {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [progressDraft, setProgressDraft] = useState(String(task.progress));
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleClickTimerRef = useRef<number | null>(null);
  const pendingTitleSelectionRef = useRef<{
    additive?: boolean;
    range?: boolean;
  } | null>(null);
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const assigneeOptions = getAssignableMembers(members, task.assigneeIds);
  const canEditFields = task.type !== "summary" && task.type !== "phase";
  const searchMatched = taskMatchesQuery(task, query);
  const dependencyIssueSummary = formatDependencyIssueSummary(dependencyIssues);
  const commentCount = task.comments?.length ?? 0;

  function getSelectionOptions(event: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }) {
    return {
      additive: Boolean(event.ctrlKey || event.metaKey),
      range: Boolean(event.shiftKey),
    };
  }

  function handleRowClick(event: MouseEvent<HTMLDivElement>) {
    onSelect(getSelectionOptions(event));
    if (event.detail < 2) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, input, select, textarea, [contenteditable='true']")
    ) {
      return;
    }
    event.preventDefault();
    onOpenInspector();
  }

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    setProgressDraft(String(task.progress));
  }, [task.progress]);

  useEffect(() => {
    if (!isEditingTitle) return;
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [isEditingTitle]);

  useEffect(() => {
    return () => {
      if (titleClickTimerRef.current !== null) {
        window.clearTimeout(titleClickTimerRef.current);
      }
    };
  }, []);

  function startTitleEdit() {
    setTitleDraft(task.title);
    setIsEditingTitle(true);
  }

  useEffect(() => {
    if (titleEditSignal > 0) startTitleEdit();
  }, [titleEditSignal]);

  function commitTitle(value: string) {
    const nextTitle = value.trim();
    if (!nextTitle) {
      setTitleDraft(task.title);
      setIsEditingTitle(false);
      return;
    }
    setTitleDraft(nextTitle);
    setIsEditingTitle(false);
    if (nextTitle !== task.title) {
      onUpdateTask(task.id, { title: nextTitle });
    }
  }

  function updateTitleDraft(value: string) {
    setTitleDraft(value);
  }

  function flushTitleSelection() {
    if (titleClickTimerRef.current !== null) {
      window.clearTimeout(titleClickTimerRef.current);
      titleClickTimerRef.current = null;
    }
    if (pendingTitleSelectionRef.current) {
      onSelect(pendingTitleSelectionRef.current);
      pendingTitleSelectionRef.current = null;
    }
  }

  /** タスク名の単クリック選択とダブルクリック編集を競合させません。 */
  function handleTitleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (titleClickTimerRef.current !== null) {
      window.clearTimeout(titleClickTimerRef.current);
      titleClickTimerRef.current = null;
    }
    if (event.detail >= 2) {
      startTitleEdit();
      return;
    }
    const selectionOptions = getSelectionOptions(event);
    pendingTitleSelectionRef.current = selectionOptions;
    titleClickTimerRef.current = window.setTimeout(() => {
      titleClickTimerRef.current = null;
      pendingTitleSelectionRef.current = null;
      onSelect(selectionOptions);
    }, 80);
  }

  function commitProgress(value: string) {
    const numericValue = Number(value);
    const progress = Number.isFinite(numericValue)
      ? Math.min(Math.max(Math.round(numericValue), 0), 100)
      : task.progress;
    setProgressDraft(String(progress));
    if (progress !== task.progress) {
      onUpdateTask(task.id, {
        progress,
        status: normalizeProgressStatus(progress),
      });
    }
  }

  function updateProgressDraft(value: string) {
    setProgressDraft(value);
  }

  return (
    <div
      className={`task-table-row ${selected ? "selected" : ""} ${
        searchMatched ? "search-match" : ""
      } ${dependencyIssues.length > 0 ? "dependency-issue" : ""} ${
        dragReordering ? "reorder-dragging" : ""
      } row-${task.type} status-${task.status}`}
      data-task-id={task.id}
      onClick={handleRowClick}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.currentTarget === event.target) flushTitleSelection();
        if (event.currentTarget !== event.target) return;
        if (event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      style={{ height: rowHeight }}
      tabIndex={0}
    >
      <span className="task-title" style={{ paddingLeft: `${task.depth * 18 + 10}px` }}>
        <button
          aria-label={`${task.title} をドラッグして並び替え`}
          className="drag-handle"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onDragHandlePointerDown}
          disabled={!canReorder}
          title={canReorder ? "ドラッグで行を移動" : "表表示では階層順を変更できません"}
          type="button"
        >
          <Bars3Icon />
        </button>
        {task.hasChildren ? (
          <span
            className={collapsed ? "collapse-button collapsed" : "collapse-button"}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <ChevronRightIcon />
          </span>
        ) : (
          <span className="collapse-spacer" aria-hidden="true" />
        )}
        {isEditingTitle ? (
          <input
            aria-label={`${task.title} のタスク名`}
            className={searchMatched ? "inline-title-input search-match" : "inline-title-input"}
            data-inline-field="title"
            data-task-id={task.id}
            onBlur={(event) => commitTitle(event.currentTarget.value)}
            onChange={(event) => updateTitleDraft(event.target.value)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(getSelectionOptions(event));
            }}
            onFocus={() => onSelect()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitTitle(event.currentTarget.value);
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.currentTarget.value = task.title;
                setTitleDraft(task.title);
                setIsEditingTitle(false);
                event.currentTarget.blur();
              }
            }}
            ref={titleInputRef}
            value={titleDraft}
          />
        ) : (
          <button
            aria-label={`${task.title} のタスク名を編集`}
            className={searchMatched ? "inline-title-display search-match" : "inline-title-display"}
            data-title-edit-trigger="true"
            data-task-id={task.id}
            onClick={handleTitleClick}
            onDoubleClick={(event) => {
              event.stopPropagation();
              startTitleEdit();
            }}
            type="button"
          >
            {task.title}
          </button>
        )}
        {dependencyIssues.length > 0 ? (
          <span
            aria-label={dependencyIssueSummary}
            className={
              dependencyIssues.some((issue) => issue.dateOrder)
                ? "dependency-alert-badge critical"
                : "dependency-alert-badge"
            }
            title={dependencyIssueSummary}
          >
            <ExclamationTriangleIcon />
          </span>
        ) : null}
        {commentCount > 0 ? (
          <button
            aria-label={`${task.title} のコメント ${commentCount}件`}
            className="task-comment-badge"
            onClick={(event) => {
              event.stopPropagation();
              onSelect({ focusTarget: "comments" });
            }}
            title={`コメント ${commentCount}件`}
            type="button"
          >
            <ChatBubbleLeftRightIcon />
            <span>{commentCount}</span>
          </button>
        ) : null}
      </span>
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
                onSelect(getSelectionOptions(event));
                if (event.detail >= 2) startTitleEdit();
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
                onUpdateTask(task.id, {
                  status: event.target.value as ScheduleTask["status"],
                })
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect(getSelectionOptions(event));
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
              onChange={(event) => updateProgressDraft(event.target.value)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(getSelectionOptions(event));
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
    </div>
  );
}

function formatDependencyIssueSummary(issues: DependencyIssue[]) {
  const dateIssues = issues.filter((issue) => issue.dateOrder);
  const incompleteIssues = issues.filter((issue) => issue.incomplete);
  const messages = [
    dateIssues.length > 0
      ? `日付要確認: ${dateIssues.map((issue) => issue.dependency.title).join(" / ")}`
      : null,
    incompleteIssues.length > 0
      ? `前提未完了: ${incompleteIssues.map((issue) => issue.dependency.title).join(" / ")}`
      : null,
  ].filter((message): message is string => Boolean(message));
  return messages.join("\n");
}
