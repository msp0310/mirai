import type { ProjectSummary, ScheduleSnapshot } from "../data/scheduleRepository";
import { getProgressStats } from "../lib/schedule";
import type { ActivityLogEntry, Member } from "../types/schedule";
import type { PendingTaskCsvImport } from "./useWorkbenchOverlays";

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

/** CSV出力用に値をエスケープします。 */
export function escapeCsv(value: string) {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
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

/** 取込データ用の重複しないIDを生成します。 */
export function createUniqueImportedId(baseId: string, existingIds: Set<string>) {
  const base = baseId.trim() || "imported-project";
  if (!existingIds.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-import`;
  while (existingIds.has(candidate)) {
    candidate = `${base}-import-${suffix}`;
    suffix += 1;
  }
  return candidate;
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

/** 文字列配列の重複を除去します。 */
export function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

/** 担当者未設定の警告が任意項目か判定します。 */
export function isOptionalAssigneeWarning(message: string) {
  return message.endsWith("に担当者が設定されていません。");
}

/** 取込データに必要なメンバーを追加します。 */
export function addMissingMembers(currentMembers: Member[], membersToCreate: Member[]) {
  if (membersToCreate.length === 0) {
    return currentMembers;
  }
  const currentIds = new Set(currentMembers.map((member) => member.id));
  const additions = membersToCreate.filter((member) => !currentIds.has(member.id));
  return additions.length === 0 ? currentMembers : [...currentMembers, ...additions];
}

/** 取込元の表示名を返します。 */
export function getTaskImportSourceLabel(sourceKind: PendingTaskCsvImport["sourceKind"]) {
  return sourceKind === "brabio" ? "Brabio XLSX" : "タスクCSV";
}
