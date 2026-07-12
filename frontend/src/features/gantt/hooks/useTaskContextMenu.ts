import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";

export type TaskContextMenuState = {
  taskId: string;
  x: number;
  y: number;
};

type UseTaskContextMenuOptions = {
  onSelectTask: (taskId: string) => void;
  selectedTaskIds: Set<string>;
};

/** タスクメニューの表示位置と、外側クリック・Escによる終了を管理します。 */
export function useTaskContextMenu({ onSelectTask, selectedTaskIds }: UseTaskContextMenuOptions) {
  const [contextMenu, setContextMenu] = useState<TaskContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openContextMenu = useCallback(
    (taskId: string, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedTaskIds.has(taskId)) {
        onSelectTask(taskId);
      }
      setContextMenu({
        taskId,
        x: Math.min(event.clientX, Math.max(window.innerWidth - 264, 12)),
        y: Math.min(event.clientY, Math.max(window.innerHeight - 470, 12)),
      });
    },
    [onSelectTask, selectedTaskIds],
  );

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    function closeWhenOutside(event: PointerEvent) {
      const { target } = event;
      if (target instanceof Node && !contextMenuRef.current?.contains(target)) {
        closeContextMenu();
      }
    }
    function closeWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [closeContextMenu, contextMenu]);

  return {
    closeContextMenu,
    contextMenu,
    contextMenuRef,
    openContextMenu,
  };
}
