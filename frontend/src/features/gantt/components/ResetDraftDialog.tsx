import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type {
  ConfigChangeReview,
  ConfigChangeRow,
  TaskChangeReview,
} from "../../../lib/changeReview";
import type { LocalDraftChangeSummary, Project } from "../../../types/schedule";

type ResetDraftDialogProps = {
  apiDetail: string;
  apiTitle: string;
  configReview: ConfigChangeReview;
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
  localDraftChangeSummary: LocalDraftChangeSummary;
  onClose: () => void;
  onConfirm: () => void;
  project: Project;
  review: TaskChangeReview;
};

/** 未保存の編集内容を破棄する確認ダイアログです。 */
export function ResetDraftDialog({
  apiDetail,
  apiTitle,
  configReview,
  hasUnsavedChanges,
  lastSavedAt,
  localDraftChangeSummary,
  onClose,
  onConfirm,
  project,
  review,
}: ResetDraftDialogProps) {
  const previewRows = review.rows.slice(0, 5);
  const hiddenCount = Math.max(review.rows.length - previewRows.length, 0);
  const configPreviewRows = configReview.rows.slice(0, 5);
  const hiddenConfigCount = Math.max(configReview.rows.length - configPreviewRows.length, 0);
  const projectLabels = [
    ...new Set(
      [...review.rows, ...configReview.rows]
        .map((row) => row.projectLabel)
        .filter((label): label is string => Boolean(label)),
    ),
  ];
  const scopeLabel =
    projectLabels.length === 0
      ? project.workspace
      : projectLabels.length === 1
        ? projectLabels[0]
        : `${projectLabels[0]} ほか${projectLabels.length - 1}プロジェクト`;

  return (
    <div className="settings-overlay" role="presentation">
      <aside
        aria-label="ローカル保存の初期化確認"
        aria-modal="true"
        className="reset-draft-sheet save-review-sheet"
        role="dialog"
      >
        <div className="panel-heading">
          <div>
            <strong>ローカル保存を初期化</strong>
            <span>{scopeLabel}</span>
          </div>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <section className="save-review-message danger" aria-label="破棄内容">
          <ExclamationTriangleIcon />
          <div>
            <strong>このブラウザの保存内容をサンプルデータへ戻します</strong>
            <p>
              未保存の変更、保存済みのローカルドラフト、API送信待ちの状態は破棄されます。
              実行後は現在のサンプル案件から再開します。
            </p>
          </div>
        </section>

        <div className="change-review-stats reset-review-stats">
          <ResetStat label="保存状態" value={hasUnsavedChanges ? "未保存あり" : "保存済み"} />
          <ResetStat label="タスク差分" value={`${review.totalCount}行`} />
          <ResetStat label="設定差分" value={`${configReview.totalCount}件`} />
          <ResetStat label="表示状態" value={`${localDraftChangeSummary.count}件`} />
          <ResetStat
            label="変更項目"
            value={`${review.fieldChangeCount + configReview.fieldChangeCount}項目`}
          />
          <ResetStat label="API状態" value={apiTitle} />
          <ResetStat label="最終保存" value={formatSavedAt(lastSavedAt)} />
        </div>

        <section className="reset-sync-summary" aria-label="同期状態">
          <strong>{apiTitle}</strong>
          <span>{apiDetail}</span>
        </section>

        {previewRows.length > 0 ? (
          <section className="save-review-section" aria-label="破棄されるタスク差分">
            <div className="save-review-section-heading">
              <strong>破棄されるタスク差分</strong>
              <span>{hiddenCount > 0 ? `ほか${hiddenCount}行` : "すべて表示中"}</span>
            </div>
            <div className="save-review-list">
              {previewRows.map((row) => (
                <article className={`change-review-row ${row.kind}`} key={row.id}>
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
          </section>
        ) : (
          <div className="change-review-empty">
            <strong>未保存のタスク差分はありません</strong>
            <span>タスク行の追加・更新・削除はありません。</span>
          </div>
        )}

        {configPreviewRows.length > 0 ? (
          <section className="save-review-section" aria-label="破棄される設定差分">
            <div className="save-review-section-heading">
              <strong>破棄される設定差分</strong>
              <span>{hiddenConfigCount > 0 ? `ほか${hiddenConfigCount}件` : "すべて表示中"}</span>
            </div>
            <div className="save-review-list">
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
          </section>
        ) : null}

        {localDraftChangeSummary.count > 0 ? (
          <section className="save-review-section" aria-label="破棄される表示状態">
            <div className="save-review-section-heading">
              <strong>破棄される表示状態</strong>
              <span>{localDraftChangeSummary.count}件</span>
            </div>
            <div className="save-review-list">
              <article className="change-review-row config project">
                <span>表示</span>
                <div>
                  <strong>前回表示・絞り込み・表示設定</strong>
                  <small>{localDraftChangeSummary.detail}</small>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        <div className="settings-actions">
          <button className="subtle-action" onClick={onClose} type="button">
            戻る
          </button>
          <button className="primary-button danger" onClick={onConfirm} type="button">
            <ArrowPathIcon />
            破棄して初期化
          </button>
        </div>
      </aside>
    </div>
  );
}

function ResetStat({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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

function formatSavedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
