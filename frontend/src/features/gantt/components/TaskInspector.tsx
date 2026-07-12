import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

import type {
  Attachment,
  CalendarDefinition,
  Member,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import { TaskBasicSection } from "./TaskBasicSection";
import { TaskCollaborationSection } from "./TaskCollaborationSection";
import { TaskRelationsSection } from "./TaskRelationsSection";

type TaskInspectorProps = {
  attachments: Attachment[];
  calendar: CalendarDefinition;
  calendarAware: boolean;
  canComment: boolean;
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
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  projectId: string;
  tasks: ScheduleTask[];
  task: ScheduleTask | null;
};

type InspectorSection = "basic" | "collaboration" | "relations";

/** 選択中タスクの詳細情報と編集項目を表示します。 */
export function TaskInspector({
  attachments,
  calendar,
  calendarAware,
  canComment,
  focusRequest,
  members,
  onClose,
  onMoveTask,
  onTaskActivity,
  onResizeTask,
  onSetTaskDates,
  onUpdateTask,
  onAttachmentAdded,
  onAttachmentDeleted,
  projectId,
  tasks,
  task,
}: TaskInspectorProps) {
  const [activeSection, setActiveSection] = useState<InspectorSection>("basic");
  const inspectorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setActiveSection("basic");
  }, [task?.id]);

  useEffect(() => {
    if (!task || !focusRequest || focusRequest.taskId !== task.id) {
      return;
    }
    if (focusRequest.target === "comments") {
      setActiveSection("collaboration");
    } else if (focusRequest.target === "dependencies") {
      setActiveSection("relations");
    } else {
      setActiveSection("basic");
    }
  }, [focusRequest?.requestId, focusRequest?.target, focusRequest?.taskId, task?.id]);

  useEffect(() => {
    if (!task || !focusRequest || focusRequest.taskId !== task.id) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const root = inspectorRef.current;
      if (!root) {
        return;
      }
      const target =
        root.querySelector<HTMLElement>(`[data-task-focus-target="${focusRequest.target}"]`) ??
        root.querySelector<HTMLElement>('[data-task-focus-target="title"]');
      if (!target) {
        return;
      }
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement && target.type === "text") {
        target.select();
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeSection,
    focusRequest?.requestId,
    focusRequest?.target,
    focusRequest?.taskId,
    task?.id,
  ]);

  if (!task) {
    return null;
  }
  const currentTask = task;
  const comments = currentTask.comments ?? [];

  return (
    <aside className="task-inspector" ref={inspectorRef}>
      <div className="panel-heading">
        <strong>タスク詳細</strong>
        <button className="close-button" onClick={onClose} aria-label="閉じる" type="button">
          <XMarkIcon />
        </button>
      </div>
      <nav className="task-inspector-tabs" aria-label="タスク詳細の表示切り替え">
        <button
          className={activeSection === "basic" ? "active" : ""}
          onClick={() => setActiveSection("basic")}
          type="button"
        >
          基本情報
        </button>
        <button
          className={activeSection === "relations" ? "active" : ""}
          onClick={() => setActiveSection("relations")}
          type="button"
        >
          完了条件・関係
        </button>
        <button
          className={activeSection === "collaboration" ? "active" : ""}
          onClick={() => setActiveSection("collaboration")}
          type="button"
        >
          コメント・添付
          {comments.length > 0 ? <span>{comments.length}</span> : null}
        </button>
      </nav>
      {activeSection === "basic" ? (
        <TaskBasicSection
          calendar={calendar}
          calendarAware={calendarAware}
          members={members}
          onMoveTask={onMoveTask}
          onResizeTask={onResizeTask}
          onSetTaskDates={onSetTaskDates}
          onTaskActivity={onTaskActivity}
          onUpdateTask={onUpdateTask}
          task={currentTask}
        />
      ) : null}
      {activeSection === "relations" ? (
        <TaskRelationsSection
          calendar={calendar}
          calendarAware={calendarAware}
          onMoveTask={onMoveTask}
          onTaskActivity={onTaskActivity}
          onUpdateTask={onUpdateTask}
          task={currentTask}
          tasks={tasks}
        />
      ) : null}
      {activeSection === "collaboration" ? (
        <TaskCollaborationSection
          attachments={attachments}
          canComment={canComment}
          onAttachmentAdded={onAttachmentAdded}
          onAttachmentDeleted={onAttachmentDeleted}
          onTaskActivity={onTaskActivity}
          onUpdateTask={onUpdateTask}
          projectId={projectId}
          task={currentTask}
        />
      ) : null}
    </aside>
  );
}
