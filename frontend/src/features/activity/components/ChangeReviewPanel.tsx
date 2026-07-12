import type { MouseEvent } from "react";

import type {
  ConfigChangeReview,
  ConfigChangeRow,
  TaskChangeReview,
} from "../../../lib/changeReview";
import type { TaskInspectorFocusTarget } from "../../../types/schedule";

type ChangeReviewPanelProps = {
  configReview: ConfigChangeReview;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  review: TaskChangeReview;
};

/** API保存前のタスク・設定差分を、フォーカス対象付きで表示します。 */
export function ChangeReviewPanel({
  configReview,
  hasUnsavedChanges,
  onSaveDraft,
  onSelectTask,
  review,
}: ChangeReviewPanelProps) {
  const previewRows = review.rows.slice(0, 8);
  const configPreviewRows = configReview.rows.slice(0, 6);
  const scheduleChangeCount = review.rows.reduce(
    (count, row) =>
      count +
      row.fields.filter((field) => field.label === "開始日" || field.label === "終了日").length,
    0,
  );
  return (
    <section className="change-review-panel" aria-label="保存前レビュー">
      <div className="change-review-heading">
        <div>
          <span>{hasUnsavedChanges ? "未保存の変更" : "保存済み"}</span>
          <strong>保存前レビュー</strong>
        </div>
        <button disabled={!hasUnsavedChanges} onClick={onSaveDraft} type="button">
          保存する
        </button>
      </div>
      <div className="change-review-stats">
        <Stat label="変更行" value={review.totalCount} />
        <Stat label="追加" value={review.addedCount} />
        <Stat label="更新" value={review.updatedCount} />
        <Stat label="削除" value={review.removedCount} />
        <Stat label="日程差分" value={scheduleChangeCount} />
        <Stat label="設定" value={configReview.totalCount} />
        <Stat label="変更項目" value={review.fieldChangeCount + configReview.fieldChangeCount} />
      </div>
      {previewRows.length > 0 || configPreviewRows.length > 0 ? (
        <div className="change-review-list">
          {previewRows.map((row) => (
            <button
              className={`change-review-row ${row.kind}`}
              disabled={row.kind === "removed"}
              key={row.id}
              onClick={(event) =>
                onSelectTask(row.taskId, getFocusTargetFromClick(event, row), row.projectId)
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
          {configPreviewRows.map((row) => (
            <article className={`change-review-row config ${row.category}`} key={row.id}>
              <span>{configCategoryLabels[row.category]}</span>
              <div>
                <strong>{row.title}</strong>
                <small>
                  {row.projectLabel && row.projectLabel !== row.title
                    ? `${row.projectLabel} / `
                    : ""}
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
      ) : (
        <div className="change-review-empty">
          <strong>保存待ちの変更はありません</strong>
          <span>タスク、案件設定、チーム、カレンダーを編集するとここに差分が表示されます。</span>
        </div>
      )}
    </section>
  );
}

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

function getFocusTargetFromClick(
  event: MouseEvent<HTMLButtonElement>,
  row: TaskChangeReview["rows"][number],
) {
  const { target } = event;
  if (target instanceof HTMLElement) {
    const fieldTarget = target.closest<HTMLElement>("[data-focus-target]")?.dataset.focusTarget;
    if (fieldTarget) {
      return fieldTarget as TaskInspectorFocusTarget;
    }
  }
  return row.fields.find((field) => field.focusTarget)?.focusTarget;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
