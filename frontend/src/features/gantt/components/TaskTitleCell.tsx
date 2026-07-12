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

import type { DependencyIssue } from "../../../lib/schedule";
import type { ScheduleTask, TaskInspectorFocusTarget, TaskRow } from "../../../types/schedule";
import { getTaskSelectionOptions } from "../utils/taskSelection";

type SelectionOptions = {
  additive?: boolean;
  focusTarget?: TaskInspectorFocusTarget;
  range?: boolean;
};

type TaskTitleCellProps = {
  canReorder: boolean;
  collapsed: boolean;
  dependencyIssues: DependencyIssue[];
  onDragHandlePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFocusTaskStart: () => void;
  onSelect: (options?: SelectionOptions) => void;
  onToggle: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  searchMatched: boolean;
  task: TaskRow;
  titleEditSignal: number;
};

/** 階層操作、タスク名編集、コメント・依存警告をタスク名セルへ閉じ込めます。 */
export function TaskTitleCell({
  canReorder,
  collapsed,
  dependencyIssues,
  onDragHandlePointerDown,
  onFocusTaskStart,
  onSelect,
  onToggle,
  onUpdateTask,
  searchMatched,
  task,
  titleEditSignal,
}: TaskTitleCellProps) {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const dependencyIssueSummary = formatDependencyIssueSummary(dependencyIssues);
  const commentCount = task.comments?.length ?? 0;

  useEffect(() => setTitleDraft(task.title), [task.title]);

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [isEditingTitle]);

  useEffect(() => {
    if (titleEditSignal > 0) {
      startTitleEdit();
    }
  }, [titleEditSignal]);

  function startTitleEdit() {
    setTitleDraft(task.title);
    setIsEditingTitle(true);
  }

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

  /** 単クリックは即時選択し、ダブルクリック時だけ編集へ切り替えます。 */
  function handleTitleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.detail >= 2) {
      startTitleEdit();
      return;
    }
    const selectionOptions = getTaskSelectionOptions(event);
    onSelect(selectionOptions);
    if (!selectionOptions.additive && !selectionOptions.range) {
      onFocusTaskStart();
    }
  }

  return (
    <span className="task-title" style={{ paddingLeft: `${task.depth * 18 + 10}px` }}>
      <button
        aria-label={`${task.title} をドラッグして並び替え`}
        className="drag-handle"
        disabled={!canReorder}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onDragHandlePointerDown}
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
          onChange={(event) => setTitleDraft(event.target.value)}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(getTaskSelectionOptions(event));
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
          title="クリックで選択 / ダブルクリックでタスク名を編集"
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
  );
}

function formatDependencyIssueSummary(issues: DependencyIssue[]) {
  const dateIssues = issues.filter((issue) => issue.dateOrder);
  const incompleteIssues = issues.filter((issue) => issue.incomplete);
  return [
    dateIssues.length > 0
      ? `日付要確認: ${dateIssues.map((issue) => issue.dependency.title).join(" / ")}`
      : null,
    incompleteIssues.length > 0
      ? `前提未完了: ${incompleteIssues.map((issue) => issue.dependency.title).join(" / ")}`
      : null,
  ]
    .filter((message): message is string => Boolean(message))
    .join("\n");
}
