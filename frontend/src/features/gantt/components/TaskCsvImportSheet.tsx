import { ArrowPathIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import {
  type ProjectImportValidation,
  type TaskCsvColumn,
  type TaskCsvImportData,
  type TaskCsvImportDraft,
  type TaskCsvImportMapping,
  taskCsvColumnLabels,
  taskCsvRequiredColumns,
} from "../../../data/scheduleImportExport";
import type { Member, Project } from "../../../types/schedule";

export type TaskCsvImportOptions = {
  expandProjectRange: boolean;
};

type TaskCsvImportSheetProps = {
  draft: TaskCsvImportDraft;
  fileName: string;
  imported: TaskCsvImportData | null;
  members: Member[];
  membersToCreate: Member[];
  onClose: () => void;
  onImport: (options: TaskCsvImportOptions) => void;
  onMappingChange: (mapping: TaskCsvImportMapping) => void;
  project: Project;
  validation: ProjectImportValidation;
};

/** Brabio由来のタスクファイルを読み込む確認画面を表示します。 */
export function TaskCsvImportSheet({
  draft,
  fileName,
  imported,
  members,
  membersToCreate,
  onClose,
  onImport,
  onMappingChange,
  project,
  validation,
}: TaskCsvImportSheetProps) {
  const summary = useMemo(() => {
    const tasks = imported?.tasks ?? [];
    const starts = tasks.map((task) => task.start).toSorted();
    const ends = tasks.map((task) => task.end).toSorted();
    const assigneeIds = new Set(tasks.flatMap((task) => task.assigneeIds));
    const dependencies = tasks.reduce((total, task) => total + (task.dependencies?.length ?? 0), 0);
    const typeCounts = { milestone: 0, phase: 0, summary: 0, task: 0 };
    tasks.forEach((task) => {
      typeCounts[task.type] += 1;
    });
    const memberLabels = [...assigneeIds]
      .map(
        (id) =>
          members.find((member) => member.id === id)?.initials ??
          members.find((member) => member.name === id)?.initials ??
          id,
      )
      .slice(0, 6);

    return {
      assigneeCount: assigneeIds.size,
      dependencyCount: dependencies,
      memberLabels,
      rangeEnd: ends.at(-1) ?? project.rangeEnd,
      rangeStart: starts[0] ?? project.rangeStart,
      rootCount: tasks.filter((task) => task.parentId === null).length,
      typeCounts,
    };
  }, [imported?.tasks, members, project.rangeEnd, project.rangeStart]);
  const rangeExpansion = useMemo(
    () => ({
      end: summary.rangeEnd > project.rangeEnd ? summary.rangeEnd : project.rangeEnd,
      needed:
        imported !== null &&
        (summary.rangeStart < project.rangeStart || summary.rangeEnd > project.rangeEnd),
      start: summary.rangeStart < project.rangeStart ? summary.rangeStart : project.rangeStart,
    }),
    [imported, project.rangeEnd, project.rangeStart, summary.rangeEnd, summary.rangeStart],
  );
  const [expandProjectRange, setExpandProjectRange] = useState(rangeExpansion.needed);
  const previewRows = useMemo(() => imported?.tasks.slice(0, 8) ?? [], [imported]);
  const requiredColumnSet = useMemo(() => new Set<TaskCsvColumn>(taskCsvRequiredColumns), []);

  useEffect(() => {
    if (rangeExpansion.needed) {
      setExpandProjectRange(true);
    }
  }, [rangeExpansion.needed, rangeExpansion.start, rangeExpansion.end]);

  const hasErrors = validation.errors.length > 0;
  const visibleErrors = validation.errors.slice(0, 4);
  const visibleWarnings = validation.warnings.slice(0, 4);

  function updateMapping(column: TaskCsvColumn, value: string) {
    const nextMapping = { ...draft.mapping };
    if (value === "") {
      delete nextMapping[column];
    } else {
      nextMapping[column] = Number(value);
    }
    onMappingChange(nextMapping);
  }

  return (
    <div className="settings-overlay" role="presentation">
      <aside
        aria-label="タスクCSVインポート確認"
        aria-modal="true"
        className="project-import-sheet task-csv-import-sheet"
        role="dialog"
      >
        <div className="panel-heading">
          <div>
            <strong>タスクCSVインポート確認</strong>
            <span>{fileName}</span>
          </div>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <section className="import-summary" aria-label="読み込み内容">
          <div>
            <span>反映先</span>
            <strong>{project.workspace}</strong>
            <small>{project.name}</small>
          </div>
          <div>
            <span>タスク行数</span>
            <strong>{draft.sourceRows}行</strong>
            <small>空行と日付ヘッダーを除いた行</small>
          </div>
          <div>
            <span>期間</span>
            <strong>
              {summary.rangeStart} - {summary.rangeEnd}
            </strong>
            <small>
              プロジェクト期間 {project.rangeStart} - {project.rangeEnd}
            </small>
          </div>
          <div>
            <span>階層</span>
            <strong>{imported ? `ルート${summary.rootCount}件` : "未確定"}</strong>
            <small>{imported ? "親IDで階層を復元" : "列マッピングを確認中"}</small>
          </div>
          <div>
            <span>種別</span>
            <strong>
              作業{summary.typeCounts.task} / フェーズ{summary.typeCounts.phase}
            </strong>
            <small>
              サマリー{summary.typeCounts.summary} / マイルストーン
              {summary.typeCounts.milestone}
            </small>
          </div>
          <div>
            <span>担当・依存</span>
            <strong>
              {summary.assigneeCount}名 / 依存{summary.dependencyCount}件
            </strong>
            <small>{summary.memberLabels.join(" / ") || "担当者なし"}</small>
          </div>
          <div>
            <span>追加メンバー</span>
            <strong>{membersToCreate.length}名</strong>
            <small>
              {membersToCreate.map((member) => member.initials).join(" / ") || "追加なし"}
            </small>
          </div>
        </section>

        <section className="csv-mapping-section" aria-label="列マッピング">
          <div className="csv-preview-heading">
            <strong>列マッピング</strong>
            <span>{draft.headers.length}列を検出</span>
          </div>
          <div className="csv-mapping-grid">
            {taskCsvMappingFields.map((column) => (
              <label className="csv-mapping-row" key={column}>
                <span>
                  {taskCsvColumnLabels[column]}
                  {requiredColumnSet.has(column) ? <small>必須</small> : null}
                </span>
                <select
                  aria-label={`${taskCsvColumnLabels[column]}に割り当てる列`}
                  onChange={(event) => updateMapping(column, event.target.value)}
                  value={draft.mapping[column] == null ? "" : String(draft.mapping[column])}
                >
                  <option value="">未設定</option>
                  {draft.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {index + 1}. {header || `${index + 1}列目`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
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
          <p className="settings-warning muted">
            現在のプロジェクトのタスク一覧をタスクCSVの内容に差し替えます。カレンダーはそのまま使います。
          </p>
          <label className={rangeExpansion.needed ? "import-mode active" : "import-mode disabled"}>
            <input
              checked={expandProjectRange}
              disabled={!rangeExpansion.needed}
              onChange={(event) => setExpandProjectRange(event.target.checked)}
              type="checkbox"
            />
            <ArrowPathIcon />
            <span>
              <strong>CSV期間まで表示範囲を広げる</strong>
              <small>
                {rangeExpansion.needed
                  ? `${rangeExpansion.start} - ${rangeExpansion.end} までプロジェクト期間を拡張`
                  : "ファイルは現在のプロジェクト期間内に収まっています。"}
              </small>
            </span>
          </label>
          <div className="import-mode active">
            <span aria-hidden="true" />
            <DocumentTextIcon />
            <span>
              <strong>タスク一覧だけを置き換え</strong>
              <small>取り込み後もUndoで直前のタスク一覧へ戻せます。</small>
            </span>
          </div>
        </section>

        <section className="csv-preview-section" aria-label="インポートプレビュー">
          <div className="csv-preview-heading">
            <strong>プレビュー</strong>
            <span>
              {previewRows.length} / {imported?.tasks.length ?? draft.sourceRows}行
            </span>
          </div>
          {imported ? (
            <div className="csv-preview-table-wrap">
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    <th>種別</th>
                    <th>タスク名</th>
                    <th>期間</th>
                    <th>担当</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((task) => (
                    <tr key={task.id}>
                      <td>{taskTypeLabels[task.type]}</td>
                      <td>
                        <strong>{task.title}</strong>
                        <small>{task.parentId ? `親: ${task.parentId}` : "ルート"}</small>
                      </td>
                      <td>
                        {task.start} - {task.end}
                      </td>
                      <td>{formatAssignees(task.assigneeIds, members)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="csv-preview-empty">
              必須列を割り当てると、取り込み前プレビューが表示されます。
            </div>
          )}
          {imported && imported.tasks.length > previewRows.length ? (
            <small className="csv-preview-note">
              ほか{imported.tasks.length - previewRows.length}
              行は取り込み時に同じルールで反映します。
            </small>
          ) : null}
        </section>

        <div className="settings-actions">
          <button className="subtle-action" onClick={onClose} type="button">
            キャンセル
          </button>
          <button
            className="primary-button"
            disabled={hasErrors || imported === null}
            onClick={() => onImport({ expandProjectRange })}
            type="button"
          >
            <ArrowPathIcon />
            タスクを置き換え
          </button>
        </div>
      </aside>
    </div>
  );
}

const taskTypeLabels = {
  milestone: "マイルストーン",
  phase: "フェーズ",
  summary: "サマリー",
  task: "作業",
} as const;

const taskCsvMappingFields: TaskCsvColumn[] = [
  "id",
  "parentId",
  "type",
  "title",
  "status",
  "start",
  "end",
  "progress",
  "assignees",
  "effortHours",
  "dependencies",
];

function formatAssignees(assigneeIds: string[], members: Member[]) {
  if (assigneeIds.length === 0) {
    return "-";
  }
  return assigneeIds
    .map(
      (id) =>
        members.find((member) => member.id === id)?.initials ??
        members.find((member) => member.name === id)?.initials ??
        id,
    )
    .join(" / ");
}
