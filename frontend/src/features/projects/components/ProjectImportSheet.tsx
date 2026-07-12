import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

import type {
  ProjectImportData,
  ProjectImportValidation,
} from "../../../data/scheduleImportExport";
import type { Project } from "../../../types/schedule";

export type ProjectImportMode = "add" | "replace";

type ProjectImportSheetProps = {
  existingProject: Project | null;
  fileName: string;
  imported: ProjectImportData;
  onClose: () => void;
  onImport: (mode: ProjectImportMode) => void;
  validation: ProjectImportValidation;
};

/** プロジェクトJSONの読み込みと置換範囲を確認する画面です。 */
export function ProjectImportSheet({
  existingProject,
  fileName,
  imported,
  onClose,
  onImport,
  validation,
}: ProjectImportSheetProps) {
  const [mode, setMode] = useState<ProjectImportMode>("add");
  const taskStats = useMemo(
    () => ({
      milestones: imported.tasks.filter((task) => task.type === "milestone").length,
      phases: imported.tasks.filter((task) => task.type === "phase").length,
      tasks: imported.tasks.filter((task) => task.type === "task").length,
      total: imported.tasks.length,
    }),
    [imported.tasks],
  );
  const canReplace = existingProject !== null;
  const selectedMode = canReplace ? mode : "add";
  const hasErrors = validation.errors.length > 0;
  const visibleErrors = validation.errors.slice(0, 4);
  const visibleWarnings = validation.warnings.slice(0, 4);

  return (
    <div className="settings-overlay" role="presentation">
      <aside
        aria-label="JSONインポート確認"
        aria-modal="true"
        className="project-import-sheet"
        role="dialog"
      >
        <div className="panel-heading">
          <div>
            <strong>JSONインポート確認</strong>
            <span>{fileName}</span>
          </div>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <section className="import-summary" aria-label="読み込み内容">
          <div>
            <span>プロジェクト</span>
            <strong>{imported.project.workspace}</strong>
            <small>{imported.project.name}</small>
          </div>
          <div>
            <span>所属チーム</span>
            <strong>{imported.team?.name ?? imported.project.teamId}</strong>
            <small>{imported.team ? "チーム定義あり" : "既存チームへ紐付け"}</small>
          </div>
          <div>
            <span>期間</span>
            <strong>
              {imported.project.rangeStart} - {imported.project.rangeEnd}
            </strong>
            <small>{imported.project.nextMilestone.title}</small>
          </div>
          <div>
            <span>タスク</span>
            <strong>{taskStats.total}件</strong>
            <small>
              フェーズ{taskStats.phases} / 作業{taskStats.tasks} / マイルストーン
              {taskStats.milestones}
            </small>
          </div>
          <div>
            <span>メンバー</span>
            <strong>{imported.members.length}名</strong>
            <small>{imported.members.map((member) => member.initials).join(" / ")}</small>
          </div>
          <div>
            <span>カレンダー</span>
            <strong>{imported.calendar.name}</strong>
            <small>休日{imported.calendar.holidays.length}件</small>
          </div>
        </section>

        {hasErrors || validation.warnings.length > 0 ? (
          <section className="import-diagnostics" aria-label="インポート診断">
            {hasErrors ? (
              <div className="import-diagnostic-block error">
                <strong>読み込み前に修正が必要です</strong>
                <ul>
                  {visibleErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {validation.errors.length > visibleErrors.length ? (
                  <small>ほか{validation.errors.length - visibleErrors.length}件</small>
                ) : null}
              </div>
            ) : null}
            {validation.warnings.length > 0 ? (
              <div className="import-diagnostic-block warning">
                <strong>確認してから読み込んでください</strong>
                <ul>
                  {visibleWarnings.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {validation.warnings.length > visibleWarnings.length ? (
                  <small>ほか{validation.warnings.length - visibleWarnings.length}件</small>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="import-diagnostics" aria-label="インポート診断">
            <div className="import-diagnostic-block ok">
              <strong>読み込み前チェックに問題はありません</strong>
              <small>親子関係、依存、担当者、日付の整合性を確認済みです。</small>
            </div>
          </section>
        )}

        <section className="import-mode-list" aria-label="取り込み方法">
          {existingProject ? (
            <p className="settings-warning muted">
              同じIDのプロジェクト「{existingProject.workspace}」が見つかりました。
            </p>
          ) : null}
          <label className={selectedMode === "add" ? "import-mode active" : "import-mode"}>
            <input checked={selectedMode === "add"} onChange={() => setMode("add")} type="radio" />
            <ArrowUpTrayIcon />
            <span>
              <strong>別プロジェクトとして追加</strong>
              <small>IDが重複する場合は自動で別名のプロジェクトにします。</small>
            </span>
          </label>
          <label
            className={
              selectedMode === "replace"
                ? "import-mode active"
                : canReplace
                  ? "import-mode"
                  : "import-mode disabled"
            }
          >
            <input
              checked={selectedMode === "replace"}
              disabled={!canReplace}
              onChange={() => setMode("replace")}
              type="radio"
            />
            {canReplace ? <ArrowPathIcon /> : <ExclamationTriangleIcon />}
            <span>
              <strong>同じIDのプロジェクトを上書き</strong>
              <small>
                {canReplace
                  ? "タスク、メンバー、カレンダーを読み込んだ内容に差し替えます。"
                  : "同じIDの既存プロジェクトがある場合に選択できます。"}
              </small>
            </span>
          </label>
        </section>

        <div className="settings-actions">
          <button className="subtle-action" onClick={onClose} type="button">
            キャンセル
          </button>
          <button
            className="primary-button"
            disabled={hasErrors}
            onClick={() => onImport(selectedMode)}
            type="button"
          >
            読み込む
          </button>
        </div>
      </aside>
    </div>
  );
}
