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
import { useMemo, useState, type ReactNode } from "react";

import type { ActivityCategory, ActivityLogEntry, Project } from "../../../types/schedule";

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

const filterCategories = Object.keys(categoryLabels) as (ActivityCategory | "all")[];

type ActivityTimelineProps = {
  entries: ActivityLogEntry[];
  onSelectTask: (taskId: string, projectId?: string) => void;
  project: Project;
  review: ReactNode;
};

/** 保存済みの操作履歴を検索・カテゴリ絞り込み付きで表示します。 */
export function ActivityTimeline({
  entries,
  onSelectTask,
  project,
  review,
}: ActivityTimelineProps) {
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (category !== "all" && entry.category !== category) {
          return false;
        }
        return (
          !normalizedQuery ||
          `${entry.title} ${entry.detail} ${entry.actor}`.toLowerCase().includes(normalizedQuery)
        );
      }),
    [category, entries, normalizedQuery],
  );
  const todayKey = new Date().toDateString();
  const latestSyncEntry = entries.find((entry) => entry.category === "sync");

  return (
    <>
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
        <ActivityStat
          label="今日"
          value={`${entries.filter((entry) => new Date(entry.happenedAt).toDateString() === todayKey).length}件`}
        />
        <ActivityStat
          label="タスク操作"
          value={`${entries.filter((entry) => entry.category === "task").length}件`}
        />
        <ActivityStat
          label="最終保存/同期"
          value={latestSyncEntry ? formatTime(latestSyncEntry.happenedAt) : "-"}
        />
      </div>
      {review}
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
          <ActivityRow entry={entry} key={entry.id} onSelectTask={onSelectTask} />
        ))}
        {filteredEntries.length === 0 ? (
          <div className="activity-empty">
            <strong>該当する履歴はありません</strong>
            <span>検索条件またはカテゴリを変更してください。</span>
          </div>
        ) : null}
      </div>
    </>
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
  return entry.taskId ? (
    <button
      className="activity-row clickable"
      onClick={() => onSelectTask(entry.taskId ?? "", entry.projectId)}
      type="button"
    >
      {contents}
    </button>
  ) : (
    <article className="activity-row">{contents}</article>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--:--"
    : date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
