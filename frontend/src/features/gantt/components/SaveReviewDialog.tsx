import { CheckCircleIcon, CloudArrowUpIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type MouseEvent, useState } from "react";

import type {
  ConfigChangeReview,
  ConfigChangeRow,
  TaskChangeReview,
} from "../../../lib/changeReview";
import type { Project, TaskInspectorFocusTarget } from "../../../types/schedule";

type SaveReviewDialogProps = {
  configReview: ConfigChangeReview;
  onClose: () => void;
  onConfirm: (changeReason?: string) => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  project: Project;
  review: TaskChangeReview;
  scopeLabel: string;
};

const changeKindLabels: Record<TaskChangeReview["rows"][number]["kind"], string> = {
  added: "追加",
  removed: "削除",
  updated: "更新",
};

const configCategoryLabels: Record<ConfigChangeRow["category"], string> = {
  calendar: "カレンダー",
  member: "メンバー",
  project: "案件",
  team: "チーム",
};

/** 保存対象と競合状態を確認してから保存を実行するダイアログです。 */
export function SaveReviewDialog({
  configReview,
  onClose,
  onConfirm,
  onSelectTask,
  project,
  review,
  scopeLabel,
}: SaveReviewDialogProps) {
  const [changeReason, setChangeReason] = useState("");
  const previewRows = review.rows.slice(0, 10);
  const hiddenCount = Math.max(review.rows.length - previewRows.length, 0);
  const configPreviewRows = configReview.rows.slice(0, 8);
  const hiddenConfigCount = Math.max(configReview.rows.length - configPreviewRows.length, 0);
  const projectLabels = [
    ...new Set(
      [...review.rows, ...configReview.rows]
        .map((row) => row.projectLabel)
        .filter((label): label is string => Boolean(label)),
    ),
  ];
  const scopeTargetLabel =
    projectLabels.length === 0
      ? project.workspace
      : projectLabels.length === 1
        ? projectLabels[0]
        : `${projectLabels[0]} ほか${projectLabels.length - 1}プロジェクト`;
  const hasScheduleDateChanges = review.rows.some((row) =>
    row.fields.some((field) => field.focusTarget === "start" || field.focusTarget === "end"),
  );
  const normalizedChangeReason = changeReason.trim();

  function selectTask(taskId: string, focusTarget?: TaskInspectorFocusTarget, projectId?: string) {
    onClose();
    onSelectTask(taskId, focusTarget, projectId);
  }

  return (
    <div className="settings-overlay" role="presentation">
      <aside aria-label="保存前確認" aria-modal="true" className="save-review-sheet" role="dialog">
        <div className="panel-heading">
          <div>
            <strong>保存前確認</strong>
            <span>
              保存範囲: {scopeLabel} / {scopeTargetLabel}
            </span>
          </div>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <section className="save-review-message" aria-label="保存内容">
          <CheckCircleIcon />
          <div>
            <strong>{scopeLabel}をAPIへ保存します</strong>
            <p>
              表示中の差分を確認し、現在の案件バージョンを基準にAPIへ送信します。競合した場合は保存せず、最新状態の確認を促します。
            </p>
          </div>
        </section>

        <div className="change-review-stats">
          <SaveReviewStat label="変更行" value={review.totalCount} />
          <SaveReviewStat label="追加" value={review.addedCount} />
          <SaveReviewStat label="更新" value={review.updatedCount} />
          <SaveReviewStat label="削除" value={review.removedCount} />
          <SaveReviewStat label="設定" value={configReview.totalCount} />
          <SaveReviewStat
            label="変更項目"
            value={review.fieldChangeCount + configReview.fieldChangeCount}
          />
        </div>

        {previewRows.length > 0 ? (
          <section className="save-review-section" aria-label="保存されるタスク差分">
            <div className="save-review-section-heading">
              <strong>保存されるタスク差分</strong>
              <span>{hiddenCount > 0 ? `ほか${hiddenCount}行` : "すべて表示中"}</span>
            </div>
            <div className="save-review-list">
              {previewRows.map((row) => (
                <button
                  className={`change-review-row ${row.kind}`}
                  disabled={row.kind === "removed"}
                  key={row.id}
                  onClick={(event) =>
                    selectTask(row.taskId, getFocusTargetFromClick(event, row), row.projectId)
                  }
                  type="button"
                >
                  <span>{changeKindLabels[row.kind]}</span>
                  <div>
                    <strong>{row.title}</strong>
                    <small>
                      {row.projectLabel ? `${row.projectLabel} / ` : ""}
                      {row.assigneeLabel} / {row.changeCount}項目
                    </small>
                  </div>
                  <ul>
                    {row.fields.slice(0, 3).map((field) => (
                      <li data-focus-target={field.focusTarget} key={`${row.id}-${field.label}`}>
                        <em>{field.label}</em>
                        <span>{field.before}</span>
                        <strong>{field.after}</strong>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {configPreviewRows.length > 0 ? (
          <section className="save-review-section" aria-label="保存される設定差分">
            <div className="save-review-section-heading">
              <strong>保存される設定差分</strong>
              <span>{hiddenConfigCount > 0 ? `ほか${hiddenConfigCount}件` : "すべて表示中"}</span>
            </div>
            <ConfigReviewRows rows={configPreviewRows} />
          </section>
        ) : null}

        {hasScheduleDateChanges ? (
          <section className="save-review-reason" aria-label="日程変更理由">
            <label htmlFor="schedule-change-reason">
              <strong>日程変更理由</strong>
              <span>必須</span>
            </label>
            <textarea
              id="schedule-change-reason"
              maxLength={500}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="例: 顧客レビュー日程の変更に伴い、基本設計以降を3営業日後ろ倒し"
              rows={3}
              value={changeReason}
            />
            <small>この保存で変更される開始日・終了日の履歴に記録します。</small>
          </section>
        ) : null}

        <div className="settings-actions">
          <button className="subtle-action" onClick={onClose} type="button">
            戻る
          </button>
          <button
            className="primary-button"
            disabled={hasScheduleDateChanges && normalizedChangeReason.length === 0}
            onClick={() => onConfirm(normalizedChangeReason || undefined)}
            type="button"
          >
            <CloudArrowUpIcon />
            確認して保存
          </button>
        </div>
      </aside>
    </div>
  );
}

function ConfigReviewRows({ rows }: { rows: ConfigChangeRow[] }) {
  return (
    <div className="save-review-list">
      {rows.map((row) => (
        <article className={`change-review-row config ${row.category}`} key={row.id}>
          <span>{configCategoryLabels[row.category]}</span>
          <div>
            <strong>{row.title}</strong>
            <small>
              {row.projectLabel && row.projectLabel !== row.title ? `${row.projectLabel} / ` : ""}
              {row.detail}
            </small>
          </div>
          <ul>
            {row.fields.slice(0, 3).map((field) => (
              <li key={`${row.id}-${field.label}`}>
                <em>{field.label}</em>
                <span>{field.before}</span>
                <strong>{field.after}</strong>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function SaveReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function getFocusTargetFromClick(
  event: MouseEvent<HTMLButtonElement>,
  row: TaskChangeReview["rows"][number],
): TaskInspectorFocusTarget | undefined {
  const { target } = event;
  if (target instanceof HTMLElement) {
    const fieldElement = target.closest<HTMLElement>("[data-focus-target]");
    const fieldTarget = fieldElement?.dataset.focusTarget;
    if (fieldTarget) {
      return fieldTarget as TaskInspectorFocusTarget;
    }
  }
  return row.fields.find((field) => field.focusTarget)?.focusTarget;
}
