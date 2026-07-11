import { useEffect } from "react";
import { viewTabs, type ViewTab } from "../../../components/layout/ViewTabs";
import type { GanttTimeUnit } from "../../../types/schedule";

type SelectionRow = { id: string };

type UseGanttKeyboardShortcutsOptions = {
  activeTab: ViewTab;
  filterOpen: boolean;
  hasTaskClipboard: boolean;
  onChangeTab: (tab: ViewTab) => void;
  onClearTaskSelection: () => void;
  onCloseCreateSheet: () => void;
  onCloseFilter: () => void;
  onCloseProjectCreateSheet: () => void;
  onCloseProjectImport: () => void;
  onCloseResetConfirm: () => void;
  onCloseSaveReview: () => void;
  onCloseShortcutHelp: () => void;
  onCloseTaskInspector: () => void;
  onCopyTask: (taskId?: string) => void;
  onDeleteSelectedTasks: (taskId?: string) => void;
  onDuplicateTask: (taskId?: string) => void;
  onFocusSelectedTitle: () => void;
  onFocusSearch: () => void;
  onFocusTaskStart: () => void;
  onInsertTaskAbove: (taskId?: string) => void;
  onInsertTaskBelow: (taskId?: string) => void;
  onIndentSelectedTasks: () => void;
  onMoveSelectedTask: (direction: -1 | 1, taskId?: string) => void;
  onOpenShortcutHelp: () => void;
  onOutdentSelectedTasks: () => void;
  onPasteTask: (taskId?: string) => void;
  onRedo: () => void;
  onRequestSave: () => void;
  onSelectAllVisibleTasks: () => void;
  onSelectOnlyTask: (taskId: string) => void;
  onSelectTask: (taskId: string, options?: { range?: boolean }) => void;
  onSetFilterOpen: (open: boolean) => void;
  onSetTimeUnit: (unit: GanttTimeUnit) => void;
  onShiftSelectedTasks: (deltaDays: number) => void;
  onShowToday: () => void;
  onUndo: () => void;
  pendingProjectImport: boolean;
  pendingTaskCsvImport: boolean;
  selectedTaskId: string | null;
  selectedTaskIds: Set<string>;
  selectionAnchorTaskId: string | null;
  showCreateSheet: boolean;
  showHelpPage: boolean;
  showProjectCreateSheet: boolean;
  showResetConfirm: boolean;
  showSaveReview: boolean;
  showShortcutHelp: boolean;
  taskInspectorTaskId: string | null;
  visibleRows: SelectionRow[];
  getTaskTitle: (taskId: string) => string | undefined;
};

/**
 * Ganttのキーボード操作とブラウザのコピー・貼り付けを登録します。
 * ショートカットの優先順位をこのフックに集約し、画面本体の再描画ロジックから分離します。
 */
export function useGanttKeyboardShortcuts({
  activeTab,
  filterOpen,
  getTaskTitle,
  hasTaskClipboard,
  onChangeTab,
  onClearTaskSelection,
  onCloseCreateSheet,
  onCloseFilter,
  onCloseProjectCreateSheet,
  onCloseProjectImport,
  onCloseResetConfirm,
  onCloseSaveReview,
  onCloseShortcutHelp,
  onCloseTaskInspector,
  onCopyTask,
  onDeleteSelectedTasks,
  onDuplicateTask,
  onFocusSearch,
  onFocusSelectedTitle,
  onFocusTaskStart,
  onIndentSelectedTasks,
  onInsertTaskAbove,
  onInsertTaskBelow,
  onMoveSelectedTask,
  onOpenShortcutHelp,
  onOutdentSelectedTasks,
  onPasteTask,
  onRedo,
  onRequestSave,
  onSelectAllVisibleTasks,
  onSelectOnlyTask,
  onSelectTask,
  onSetFilterOpen,
  onSetTimeUnit,
  onShiftSelectedTasks,
  onShowToday,
  onUndo,
  pendingProjectImport,
  pendingTaskCsvImport,
  selectedTaskId,
  selectedTaskIds,
  selectionAnchorTaskId,
  showCreateSheet,
  showHelpPage,
  showProjectCreateSheet,
  showResetConfirm,
  showSaveReview,
  showShortcutHelp,
  taskInspectorTaskId,
  visibleRows,
}: UseGanttKeyboardShortcutsOptions) {
  useEffect(() => {
    function isEditingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function getEventTaskId(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      return target.closest(".task-table-row")?.getAttribute("data-task-id") ?? null;
    }

    function scrollTaskIntoView(taskId: string) {
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-task-id="${taskId}"]`)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    }

    function selectByIndex(nextIndex: number, range = false) {
      const nextTask = visibleRows[nextIndex];
      if (!nextTask) return;
      if (range && selectionAnchorTaskId) onSelectTask(nextTask.id, { range: true });
      else onSelectOnlyTask(nextTask.id);
      scrollTaskIntoView(nextTask.id);
    }

    function selectByOffset(offset: number, range = false) {
      if (visibleRows.length === 0) return;
      const currentIndex = visibleRows.findIndex((row) => row.id === selectedTaskId);
      const fallbackIndex = offset > 0 ? 0 : visibleRows.length - 1;
      const nextIndex =
        currentIndex === -1
          ? fallbackIndex
          : Math.min(Math.max(currentIndex + offset, 0), visibleRows.length - 1);
      selectByIndex(nextIndex, range);
    }

    function selectByPage(direction: -1 | 1, range = false) {
      if (visibleRows.length === 0) return;
      const currentIndex = visibleRows.findIndex((row) => row.id === selectedTaskId);
      const table = document.querySelector<HTMLElement>(".task-table");
      const visibleRowCount = table ? Math.max(Math.floor(table.clientHeight / 34) - 2, 6) : 10;
      const fallbackIndex = direction > 0 ? 0 : visibleRows.length - 1;
      const nextIndex =
        currentIndex === -1
          ? fallbackIndex
          : Math.min(
              Math.max(currentIndex + visibleRowCount * direction, 0),
              visibleRows.length - 1,
            );
      selectByIndex(nextIndex, range);
    }

    function selectBoundary(position: "first" | "last", range = false) {
      if (visibleRows.length === 0) return;
      selectByIndex(position === "first" ? 0 : visibleRows.length - 1, range);
    }

    function closeActiveSurface() {
      if (showResetConfirm) {
        onCloseResetConfirm();
        return true;
      }
      if (showSaveReview) {
        onCloseSaveReview();
        return true;
      }
      if (pendingProjectImport) {
        onCloseProjectImport();
        return true;
      }
      if (pendingTaskCsvImport) {
        onCloseProjectImport();
        return true;
      }
      if (showShortcutHelp) {
        onCloseShortcutHelp();
        return true;
      }
      if (showProjectCreateSheet) {
        onCloseProjectCreateSheet();
        return true;
      }
      if (showCreateSheet) {
        onCloseCreateSheet();
        return true;
      }
      if (taskInspectorTaskId) {
        onCloseTaskInspector();
        return true;
      }
      if (selectedTaskId || selectedTaskIds.size > 0) {
        onClearTaskSelection();
        return true;
      }
      if (filterOpen) {
        onCloseFilter();
        return true;
      }
      return false;
    }

    function hasActiveSurface() {
      return Boolean(
        showResetConfirm ||
        showSaveReview ||
        pendingProjectImport ||
        pendingTaskCsvImport ||
        showShortcutHelp ||
        showProjectCreateSheet ||
        showCreateSheet ||
        taskInspectorTaskId,
      );
    }

    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      const key = event.key.toLowerCase();
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && key === "s") {
        event.preventDefault();
        onRequestSave();
        return;
      }
      if (isEditingTarget(event.target)) return;

      if (event.key === "Escape") {
        if (closeActiveSurface()) event.preventDefault();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        onOpenShortcutHelp();
        return;
      }
      if (showHelpPage) return;
      if (
        event.altKey &&
        !commandKey &&
        !event.shiftKey &&
        /^[1-9]$/.test(event.key) &&
        !hasActiveSurface()
      ) {
        const nextTab = viewTabs[Number(event.key) - 1];
        if (nextTab) {
          event.preventDefault();
          onChangeTab(nextTab);
        }
        return;
      }

      if (commandKey && key === "z") {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (commandKey && key === "y") {
        event.preventDefault();
        onRedo();
        return;
      }

      if (activeTab === "Gantt" && commandKey && !event.altKey) {
        const eventTaskId = getEventTaskId(event.target);
        const isMoveUpShortcut = key === "<" || (event.shiftKey && event.code === "Comma");
        const isMoveDownShortcut = key === ">" || (event.shiftKey && event.code === "Period");
        if (isMoveUpShortcut) {
          event.preventDefault();
          onMoveSelectedTask(-1, eventTaskId ?? undefined);
          return;
        }
        if (isMoveDownShortcut) {
          event.preventDefault();
          onMoveSelectedTask(1, eventTaskId ?? undefined);
          return;
        }
        if (key === "c") {
          event.preventDefault();
          onCopyTask(eventTaskId ?? undefined);
          return;
        }
        if (key === "v") {
          event.preventDefault();
          onPasteTask(eventTaskId ?? undefined);
          return;
        }
        if (key === "d") {
          event.preventDefault();
          onDuplicateTask(eventTaskId ?? undefined);
          return;
        }
        if (key === "a") {
          event.preventDefault();
          onSelectAllVisibleTasks();
          return;
        }
      }

      if (
        activeTab === "Gantt" &&
        event.altKey &&
        !commandKey &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault();
        onShiftSelectedTasks(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }

      if (activeTab !== "Gantt" || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.shiftKey && event.key === "ArrowDown") {
        event.preventDefault();
        selectByOffset(1, true);
        return;
      }
      if (event.shiftKey && event.key === "ArrowUp") {
        event.preventDefault();
        selectByOffset(-1, true);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectByOffset(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectByOffset(-1);
        return;
      }
      if (event.key === "PageDown") {
        event.preventDefault();
        selectByPage(1, event.shiftKey);
        return;
      }
      if (event.key === "PageUp") {
        event.preventDefault();
        selectByPage(-1, event.shiftKey);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        if (event.shiftKey || !selectedTaskId) selectBoundary("first", event.shiftKey);
        else onFocusTaskStart();
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        selectBoundary("last", event.shiftKey);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndentSelectedTasks();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onOutdentSelectedTasks();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) onInsertTaskBelow(getEventTaskId(event.target) ?? undefined);
        else onFocusSelectedTitle();
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        onFocusSelectedTitle();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const eventTaskId = getEventTaskId(event.target);
        onDeleteSelectedTasks(
          eventTaskId && !selectedTaskIds.has(eventTaskId) ? eventTaskId : undefined,
        );
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        onFocusSearch();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        onInsertTaskBelow(getEventTaskId(event.target) ?? undefined);
        return;
      }
      if (key === "u") {
        event.preventDefault();
        onInsertTaskAbove(getEventTaskId(event.target) ?? undefined);
        return;
      }
      if (key === "l") {
        event.preventDefault();
        onInsertTaskBelow(getEventTaskId(event.target) ?? undefined);
        return;
      }
      if (key === "f") {
        event.preventDefault();
        onSetFilterOpen(!filterOpen);
        return;
      }
      if (key === "t") {
        event.preventDefault();
        onShowToday();
        return;
      }
      if (key === "1") {
        event.preventDefault();
        onSetTimeUnit("day");
        return;
      }
      if (key === "2") {
        event.preventDefault();
        onSetTimeUnit("week");
        return;
      }
      if (key === "3") {
        event.preventDefault();
        onSetTimeUnit("month");
      }
    }

    function handleCopy(event: ClipboardEvent) {
      if (activeTab !== "Gantt" || isEditingTarget(event.target)) return;
      const taskId = getEventTaskId(event.target) ?? selectedTaskId;
      if (!taskId) return;
      onCopyTask(taskId && !selectedTaskIds.has(taskId) ? taskId : undefined);
      event.clipboardData?.setData("text/plain", getTaskTitle(taskId) ?? "");
      event.preventDefault();
    }

    function handlePaste(event: ClipboardEvent) {
      if (activeTab !== "Gantt" || isEditingTarget(event.target)) return;
      if (!hasTaskClipboard) return;
      onPasteTask(getEventTaskId(event.target) ?? undefined);
      event.preventDefault();
    }

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    activeTab,
    filterOpen,
    getTaskTitle,
    hasTaskClipboard,
    onChangeTab,
    onClearTaskSelection,
    onCloseCreateSheet,
    onCloseFilter,
    onCloseProjectCreateSheet,
    onCloseProjectImport,
    onCloseResetConfirm,
    onCloseSaveReview,
    onCloseShortcutHelp,
    onCloseTaskInspector,
    onCopyTask,
    onDeleteSelectedTasks,
    onDuplicateTask,
    onFocusSearch,
    onFocusSelectedTitle,
    onFocusTaskStart,
    onIndentSelectedTasks,
    onInsertTaskAbove,
    onInsertTaskBelow,
    onMoveSelectedTask,
    onOpenShortcutHelp,
    onOutdentSelectedTasks,
    onPasteTask,
    onRedo,
    onRequestSave,
    onSelectAllVisibleTasks,
    onSelectOnlyTask,
    onSelectTask,
    onSetFilterOpen,
    onSetTimeUnit,
    onShiftSelectedTasks,
    onShowToday,
    onUndo,
    pendingProjectImport,
    pendingTaskCsvImport,
    selectedTaskId,
    selectedTaskIds,
    selectionAnchorTaskId,
    showCreateSheet,
    showHelpPage,
    showProjectCreateSheet,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
    taskInspectorTaskId,
    visibleRows,
  ]);
}
