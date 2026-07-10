import {
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState, type MouseEvent } from "react";
import type {
  ConfigChangeReview,
  ConfigChangeRow,
  TaskChangeReview,
} from "../../../lib/changeReview";
import type {
  ActivityCategory,
  ActivityLogEntry,
  Project,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";

type ActivityPanelProps = {
  changeReview: TaskChangeReview;
  configReview: ConfigChangeReview;
  entries: ActivityLogEntry[];
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  project: Project;
};

const categoryLabels: Record<ActivityCategory | "all", string> = {
  all: "すべて",
  calendar: "カレンダー",
  import: "入出力",
  issue: "課題",
  project: "プロジェクト",
  sync: "保存/同期",
  task: "タスク",
  team: "チーム",
  workLog: "作業時間",
};

const categoryIcons: Record<ActivityCategory, typeof CheckCircleIcon> = {
  calendar: CalendarDaysIcon,
  import: CircleStackIcon,
  issue: ExclamationTriangleIcon,
  project: CheckCircleIcon,
  sync: ArrowsRightLeftIcon,
  task: CheckCircleIcon,
  team: UserGroupIcon,
  workLog: WrenchScrewdriverIcon,
};

const filterCategories: Array<ActivityCategory | "all"> = [
  "all",
  "task",
  "issue",
  "workLog",
  "project",
  "team",
  "calendar",
  "sync",
  "import",
];

/** プロジェクト内の変更履歴を時系列で表示します。 */
export function ActivityPanel({
  changeReview,
  configReview,
  entries,
  hasUnsavedChanges,
  onSaveDraft,
  onSelectTask,
  project,
}: ActivityPanelProps) {
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const todayKey = new Date().toDateString();
  const todayEntries = entries.filter(
    (entry) => new Date(entry.happenedAt).toDateString() === todayKey,
  );
  const taskEntries = entries.filter((entry) => entry.category === "task");
  const syncEntries = entries.filter((entry) => entry.category === "sync");

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const categoryMatched = category === "all" || entry.category === category;
        if (!categoryMatched) return false;
        if (!normalizedQuery) return true;
        return `${entry.title} ${entry.detail} ${entry.actor}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [category, entries, normalizedQuery],
  );

  return (
    <section className="activity-panel" aria-label="変更履歴">
      <div className="activity-header">
        <div>
          <span>{project.workspace}</span>
          <h2>変更履歴</h2>
        </div>
        <div className="activity-search">
          <MagnifyingGlassIcon />
          <input
            aria-label="変更履歴を検索"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="操作・タスク・担当者を検索"
            value={query}
          />
        </div>
      </div>

      <div className="activity-summary">
        <ActivityStat label="全履歴" value={`${entries.length}件`} />
        <ActivityStat label="今日" value={`${todayEntries.length}件`} />
        <ActivityStat label="タスク操作" value={`${taskEntries.length}件`} />
        <ActivityStat
          label="最終保存/同期"
          value={syncEntries[0] ? formatTime(syncEntries[0].happenedAt) : "-"}
        />
      </div>

      <ChangeReviewPanel
        configReview={configReview}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveDraft={onSaveDraft}
        onSelectTask={onSelectTask}
        review={changeReview}
      />

      <div className="activity-filter" aria-label="履歴カテゴリ">
        {filterCategories.map((item) => (
          <button
            className={category === item ? "active" : ""}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {categoryLabels[item]}
          </button>
        ))}
      </div>

      <div className="activity-list">
        {filteredEntries.map((entry) => (
          <ActivityRow
            entry={entry}
            key={entry.id}
            onSelectTask={(taskId, projectId) => onSelectTask(taskId, undefined, projectId)}
          />
        ))}
        {filteredEntries.length === 0 ? (
          <div className="activity-empty">
            <strong>該当する履歴はありません</strong>
            <span>検索条件またはカテゴリを変更してください。</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ActivityStat({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActivityRow({
  entry,
  onSelectTask,
}: {
  entry: ActivityLogEntry;
  onSelectTask: (taskId: string, projectId?: string) => void;
}) {
  const Icon = categoryIcons[entry.category];
  const contents = (
    <>
      <span className={`activity-icon ${entry.tone}`}>
        <Icon />
      </span>
      <div className="activity-main">
        <div>
          <strong>{entry.title}</strong>
          <span>{categoryLabels[entry.category]}</span>
        </div>
        <p>{entry.detail}</p>
      </div>
      <div className="activity-meta">
        <strong>{formatTime(entry.happenedAt)}</strong>
        <span>{entry.actor}</span>
      </div>
    </>
  );

  if (!entry.taskId) {
    return <article className="activity-row">{contents}</article>;
  }

  return (
    <button
      className="activity-row clickable"
      onClick={() => onSelectTask(entry.taskId ?? "", entry.projectId)}
      type="button"
    >
      {contents}
    </button>
  );
}

function ChangeReviewPanel({
  configReview,
  hasUnsavedChanges,
  onSaveDraft,
  onSelectTask,
  review,
}: {
  configReview: ConfigChangeReview;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  review: TaskChangeReview;
}) {
  const previewRows = review.rows.slice(0, 8);
  const configPreviewRows = configReview.rows.slice(0, 6);
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
        <ChangeReviewStat label="変更行" value={review.totalCount} />
        <ChangeReviewStat label="追加" value={review.addedCount} />
        <ChangeReviewStat label="更新" value={review.updatedCount} />
        <ChangeReviewStat label="削除" value={review.removedCount} />
        <ChangeReviewStat label="設定" value={configReview.totalCount} />
        <ChangeReviewStat
          label="変更項目"
          value={review.fieldChangeCount + configReview.fieldChangeCount}
        />
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
): TaskInspectorFocusTarget | undefined {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const fieldElement = target.closest<HTMLElement>("[data-focus-target]");
    const fieldTarget = fieldElement?.dataset.focusTarget;
    if (fieldTarget) return fieldTarget as TaskInspectorFocusTarget;
  }
  return row.fields.find((field) => field.focusTarget)?.focusTarget;
}

function ChangeReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
