import type { ProjectSummary, ScheduleSnapshot } from "../data/scheduleRepository";
import { getProgressStats } from "../lib/schedule";
import type { ActivityLogEntry } from "../types/schedule";

/** 表示履歴に記録する操作ユーザー名です。認証ユーザー表示への切替点を固定します。 */
export const activityActor = "操作ユーザー";

/** 指定したタスクのタイトル編集欄へフォーカスを移します。 */
export function focusTaskTitleEditor(taskId: string) {
  const rowSelector = `.task-table-row[data-task-id="${taskId}"]`;
  const inputSelector = `${rowSelector} input[data-inline-field="title"]`;

  function focusInput() {
    const input = document.querySelector<HTMLInputElement>(inputSelector);
    if (!input) {
      return false;
    }
    input.focus();
    input.select();
    return true;
  }

  if (focusInput()) {
    return;
  }
  document
    .querySelector<HTMLElement>(`${rowSelector} [data-title-edit-trigger="true"]`)
    ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
  window.requestAnimationFrame(focusInput);
}

/** テキストファイルをブラウザからダウンロードします。 */
export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 遅延ロード中のプロジェクトビューに表示する共通プレースホルダーです。 */
export function ViewLoading({ label }: { label: string }) {
  return <div className="view-loading">{label}</div>;
}

/** 詳細スナップショットから案件一覧用の軽量集計を一度だけ作成します。 */
export function createProjectSummaryFromSnapshot(snapshot: ScheduleSnapshot): ProjectSummary {
  const stats = getProgressStats(snapshot.tasks);
  return {
    completedTaskCount: stats.completed,
    delayedTaskCount: snapshot.tasks.filter(
      (task) => task.type === "task" && task.status === "delayed",
    ).length,
    memberCount: snapshot.project.memberIds?.length ?? snapshot.members.length,
    progress: stats.progress,
    project: snapshot.project,
    taskCount: stats.total,
  };
}

/** 操作履歴を上限付きで先頭へ追加します。 */
export function appendActivityLogEntry(
  logs: Record<string, ActivityLogEntry[]>,
  entry: ActivityLogEntry,
) {
  return {
    ...logs,
    [entry.projectId]: [entry, ...(logs[entry.projectId] ?? [])].slice(0, 160),
  };
}
