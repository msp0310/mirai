import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import type {
  ProjectImportValidation,
  TaskCsvImportData,
} from "../../../data/scheduleImportExport";
import type { Member, Project } from "../../../types/schedule";
import type { TaskCsvImportOptions } from "../../projects/types/projectImport";

type BrabioTaskImportSheetProps = {
  fileName: string;
  imported: TaskCsvImportData | null;
  members: Member[];
  membersToCreate: Member[];
  onClose: () => void;
  onImport: (options: TaskCsvImportOptions) => void;
  project: Project;
  sourceRows: number;
  validation: ProjectImportValidation;
};

/** Brabio形式のExcelタスクを案件へ取り込む確認画面です。 */
export function BrabioTaskImportSheet({
  fileName,
  imported,
  members,
  membersToCreate,
  onClose,
  onImport,
  project,
  sourceRows,
  validation,
}: BrabioTaskImportSheetProps) {
  const summary = useMemo(() => {
    const tasks = imported?.tasks ?? [];
    const starts = tasks.map((task) => task.start).toSorted();
    const ends = tasks.map((task) => task.end).toSorted();
    const assigneeIds = new Set(tasks.flatMap((task) => task.assigneeIds));
    const memberLabels = [...assigneeIds]
      .map(
        (id) =>
          members.find((member) => member.id === id)?.initials ??
          members.find((member) => member.name === id)?.initials ??
          id,
      )
      .slice(0, 8);

    return {
      assigneeCount: assigneeIds.size,
      memberLabels,
      rangeEnd: ends.at(-1) ?? project.rangeEnd,
      rangeStart: starts[0] ?? project.rangeStart,
      taskCount: imported?.tasks.length ?? sourceRows,
    };
  }, [imported?.tasks, members, project.rangeEnd, project.rangeStart, sourceRows]);
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

  useEffect(() => {
    if (rangeExpansion.needed) {
      setExpandProjectRange(true);
    }
  }, [rangeExpansion.needed, rangeExpansion.start, rangeExpansion.end]);

  const hasErrors = validation.errors.length > 0;
  const visibleErrors = validation.errors.slice(0, 3);
  const displayWarnings = validation.warnings.filter(
    (message) => !isOptionalAssigneeWarning(message),
  );
  const visibleWarnings = displayWarnings.slice(0, 3);

  return (
    <div className="settings-overlay" role="presentation">
      <aside
        aria-label="Brabioタスク読み込み"
        aria-modal="true"
        className="project-import-sheet brabio-import-sheet"
        role="dialog"
      >
        <div className="panel-heading">
          <div>
            <strong>Brabioタスクを読み込み</strong>
            <span>{fileName}</span>
          </div>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <div className="brabio-import-lead">
          <strong>{summary.taskCount}行のタスクを取り込みます</strong>
          <span>現在のプロジェクトのタスク一覧をBrabioの内容に置き換えます。</span>
        </div>

        <section className="import-summary brabio-summary" aria-label="読み込み内容">
          <div>
            <span>反映先</span>
            <strong>{project.workspace}</strong>
            <small>{project.name}</small>
          </div>
          <div>
            <span>期間</span>
            <strong>
              {summary.rangeStart} - {summary.rangeEnd}
            </strong>
            <small>
              現在 {project.rangeStart} - {project.rangeEnd}
            </small>
          </div>
          <div>
            <span>担当者</span>
            <strong>{summary.assigneeCount}名</strong>
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

        {hasErrors || displayWarnings.length > 0 ? (
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
            {displayWarnings.length > 0 ? (
              <div className="import-diagnostic-block warning">
                <strong>確認してから読み込んでください</strong>
                <ul>
                  {visibleWarnings.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {displayWarnings.length > visibleWarnings.length ? (
                  <small>ほか{displayWarnings.length - visibleWarnings.length}件</small>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {rangeExpansion.needed ? (
          <section className="import-mode-list compact" aria-label="取り込み方法">
            <label className="import-mode active">
              <input
                checked={expandProjectRange}
                onChange={(event) => setExpandProjectRange(event.target.checked)}
                type="checkbox"
              />
              <ArrowPathIcon />
              <span>
                <strong>Brabioの期間まで表示範囲を広げる</strong>
                <small>
                  {rangeExpansion.start} - {rangeExpansion.end} までプロジェクト期間を拡張
                </small>
              </span>
            </label>
          </section>
        ) : null}

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
            この内容で取り込む
          </button>
        </div>
      </aside>
    </div>
  );
}

function isOptionalAssigneeWarning(message: string) {
  return message.endsWith("に担当者が設定されていません。");
}
