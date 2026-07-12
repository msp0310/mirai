import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { ScheduleTask, Team } from "../../../types/schedule";

type ProjectExportFormat = "csv" | "json";

/** 案件とタスクを、ブラウザーから保存できるファイルへ変換します。 */
export function createProjectExportFile(
  format: ProjectExportFormat,
  schedule: ScheduleSnapshot,
  tasks: ScheduleTask[],
  team?: Team,
) {
  const exportDate = new Date().toISOString().slice(0, 10);
  const fileBase = `${schedule.project.workspace}-${exportDate}`;
  if (format === "json") {
    return {
      activityTitle: "プロジェクトJSONを書き出しました",
      content: JSON.stringify(
        {
          calendar: schedule.calendar,
          members: schedule.members,
          project: schedule.project,
          tasks,
          team,
        },
        null,
        2,
      ),
      fileName: `${fileBase}.json`,
      mimeType: "application/json",
      toastTitle: "JSONを書き出しました",
    };
  }

  const header = [
    "ID",
    "親ID",
    "種別",
    "タスク名",
    "状態",
    "開始日",
    "終了日",
    "進捗",
    "担当者",
    "工数",
    "依存",
  ];
  const rows = tasks.map((task) => [
    task.id,
    task.parentId ?? "",
    task.type,
    task.title,
    task.status,
    task.start,
    task.end,
    String(task.progress),
    task.assigneeIds
      .map((id) => schedule.members.find((member) => member.id === id)?.name ?? id)
      .join(" / "),
    task.effortHours != null ? String(task.effortHours) : "",
    (task.dependencies ?? []).join(" / "),
  ]);
  return {
    activityTitle: "タスク一覧CSVを書き出しました",
    content: [header, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n"),
    fileName: `${fileBase}.csv`,
    mimeType: "text/csv;charset=utf-8",
    toastTitle: "CSVを書き出しました",
  };
}

function escapeCsv(value: string) {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
