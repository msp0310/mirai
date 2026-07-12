import { ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import {
  addDays,
  formatShortDate,
  isWorkingDay,
  parseDate,
  toDateKey,
} from "../../../lib/schedule";
import type { CalendarDefinition, ScheduleTask } from "../../../types/schedule";
import { TaskChecklistSection } from "./TaskChecklistSection";
import { TaskReferenceLinksSection } from "./TaskReferenceLinksSection";

type TaskRelationsSectionProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onTaskActivity: (
    taskId: string,
    title: string,
    detail: string,
    tone?: "danger" | "info" | "success" | "warning",
  ) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  task: ScheduleTask;
  tasks: ScheduleTask[];
};

/** 完了条件、前提タスク、参考リンクを一つの関係タブとして管理します。 */
export function TaskRelationsSection({
  calendar,
  calendarAware,
  onMoveTask,
  onTaskActivity,
  onUpdateTask,
  task,
  tasks,
}: TaskRelationsSectionProps) {
  const [query, setQuery] = useState("");
  const selectedIds = task.dependencies ?? [];
  const selectedIdSet = new Set(selectedIds);
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = useMemo(
    () =>
      getDependencyCandidates(tasks, task)
        .filter((candidate) => {
          if (selectedIdSet.has(candidate.id) || !normalizedQuery) {
            return true;
          }
          return (
            candidate.title.toLowerCase().includes(normalizedQuery) ||
            candidate.id.toLowerCase().includes(normalizedQuery)
          );
        })
        .toSorted((a, b) => {
          const aSelected = selectedIdSet.has(a.id);
          const bSelected = selectedIdSet.has(b.id);
          return aSelected !== bSelected
            ? aSelected
              ? -1
              : 1
            : a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
        }),
    [normalizedQuery, selectedIds.join("\u0000"), task, tasks],
  );
  const warnings = selectedIds
    .map((dependencyId) => tasks.find((item) => item.id === dependencyId))
    .filter((dependency): dependency is ScheduleTask => Boolean(dependency))
    .map((dependency) => ({
      dateConflict: dependency.end >= task.start,
      dependency,
      incomplete: dependency.status !== "done",
    }))
    .filter((warning) => warning.incomplete || warning.dateConflict);

  useEffect(() => setQuery(""), [task.id]);

  function toggleDependency(dependencyId: string) {
    onUpdateTask(task.id, {
      dependencies: selectedIds.includes(dependencyId)
        ? selectedIds.filter((id) => id !== dependencyId)
        : [...selectedIds, dependencyId],
    });
  }

  function removeDependency(dependencyId: string) {
    const dependency = tasks.find((item) => item.id === dependencyId);
    onUpdateTask(task.id, { dependencies: selectedIds.filter((id) => id !== dependencyId) });
    onTaskActivity(
      task.id,
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
      `${task.title} の前提確認から更新しました。`,
      "success",
    );
  }

  function alignAfterBlockingDependencies() {
    const [latestDependency] = warnings
      .filter((warning) => warning.dateConflict)
      .map((warning) => warning.dependency)
      .toSorted((a, b) => b.end.localeCompare(a.end));
    if (!latestDependency) {
      return;
    }
    const start = getNextWorkingStartAfter(latestDependency.end, calendar, calendarAware);
    if (task.type === "phase") {
      onMoveTask(task.id, getDateDiffDays(task.start, start));
    } else {
      onUpdateTask(task.id, { start });
    }
    onTaskActivity(
      task.id,
      "前提後ろへ日程を調整しました",
      `${latestDependency.title} の完了後に ${formatShortDate(start)} 開始へ調整しました。`,
      "info",
    );
  }

  return (
    <>
      <TaskChecklistSection
        onTaskActivity={onTaskActivity}
        onUpdateTask={onUpdateTask}
        task={task}
      />
      <div className="check-list dependency-list">
        <div className="dependency-list-heading">
          <span>前提タスク</span>
          <small>
            {selectedIds.length}件選択 / {candidates.length}件表示
          </small>
        </div>
        <label className="dependency-search">
          <MagnifyingGlassIcon />
          <input
            aria-label="前提タスクを検索"
            data-task-focus-target="dependencies"
            disabled={task.type === "summary"}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="タスク名で検索"
            value={query}
          />
        </label>
        {warnings.length > 0 ? (
          <div className="dependency-warning-stack">
            {warnings.some((warning) => warning.dateConflict) ? (
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
            {warnings.slice(0, 3).map((warning) => (
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
          {candidates.map((candidate) => (
            <label key={candidate.id}>
              <input
                checked={selectedIdSet.has(candidate.id)}
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
        {candidates.length === 0 ? (
          <p className="dependency-empty">一致する前提タスクがありません</p>
        ) : null}
      </div>
      <TaskReferenceLinksSection
        onTaskActivity={onTaskActivity}
        onUpdateTask={onUpdateTask}
        task={task}
      />
    </>
  );
}

function getDependencyCandidates(tasks: ScheduleTask[], currentTask: ScheduleTask) {
  const descendantIds = getDescendantTaskIds(tasks, currentTask.id);
  return tasks.filter(
    (candidate) =>
      candidate.id !== currentTask.id &&
      candidate.type !== "summary" &&
      candidate.type !== "phase" &&
      !descendantIds.has(candidate.id) &&
      !dependencyPathReaches(tasks, candidate.id, currentTask.id, new Set()),
  );
}

function getDescendantTaskIds(tasks: ScheduleTask[], taskId: string) {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    tasks
      .filter((item) => item.parentId === parentId)
      .forEach((item) => {
        ids.add(item.id);
        visit(item.id);
      });
  };
  visit(taskId);
  return ids;
}

function dependencyPathReaches(
  tasks: ScheduleTask[],
  sourceId: string,
  targetId: string,
  visited: Set<string>,
): boolean {
  if (sourceId === targetId) {
    return true;
  }
  if (visited.has(sourceId)) {
    return false;
  }
  visited.add(sourceId);
  const source = tasks.find((item) => item.id === sourceId);
  return (source?.dependencies ?? []).some((id) =>
    dependencyPathReaches(tasks, id, targetId, visited),
  );
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
  if (!calendarAware) {
    return toDateKey(date);
  }
  while (!isWorkingDay(date, calendar, true)) {
    date = addDays(date, 1);
  }
  return toDateKey(date);
}
