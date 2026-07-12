import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReportEntry, WorkLogCategory } from "../../../types/schedule";
import { categoryLabels, createDailyReportEntry, sumDailyReportHours } from "../model/dailyReports";

import * as styles from "./DailyReportPage.css";

type DailyReportEntriesProps = {
  entries: DailyReportEntry[];
  onChange: (entries: DailyReportEntry[]) => void;
  readOnly: boolean;
  schedules: ScheduleSnapshot[];
};

/** 案件・タスク別の作業時間明細を編集します。 */
export function DailyReportEntries({
  entries,
  onChange,
  readOnly,
  schedules,
}: DailyReportEntriesProps) {
  function updateEntry(entryId: string, patch: Partial<DailyReportEntry>) {
    onChange(entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)));
  }

  return (
    <section className={styles.entrySection}>
      <header className={styles.sectionHeader}>
        <div>
          <strong>作業明細</strong>
          <span>合計 {sumDailyReportHours(entries)}h</span>
        </div>
        <button
          className={styles.secondaryButton}
          disabled={readOnly}
          onClick={() =>
            onChange([...entries, createDailyReportEntry(schedules[0]?.project.id ?? "")])
          }
          type="button"
        >
          <PlusIcon className={styles.buttonIcon} />
          明細追加
        </button>
      </header>
      <div className={styles.entryLabels} aria-hidden="true">
        <span>案件</span>
        <span>タスク</span>
        <span>時間</span>
        <span>分類</span>
      </div>
      {entries.map((entry) => {
        const schedule = schedules.find((item) => item.project.id === entry.projectId);
        return (
          <div className={styles.entry} key={entry.id}>
            <select
              aria-label="案件"
              className={styles.select}
              disabled={readOnly}
              onChange={(event) =>
                updateEntry(entry.id, { projectId: event.target.value, taskId: undefined })
              }
              value={entry.projectId}
            >
              {schedules.map((item) => (
                <option key={item.project.id} value={item.project.id}>
                  {item.project.workspace}
                </option>
              ))}
            </select>
            <select
              aria-label="タスク"
              className={styles.select}
              disabled={readOnly}
              onChange={(event) =>
                updateEntry(entry.id, { taskId: event.target.value || undefined })
              }
              value={entry.taskId ?? ""}
            >
              <option value="">タスク未指定</option>
              {schedule?.tasks
                .filter((task) => task.type === "task")
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </select>
            <input
              aria-label="作業時間"
              className={styles.hoursInput}
              disabled={readOnly}
              min="0.25"
              onChange={(event) => updateEntry(entry.id, { hours: Number(event.target.value) })}
              step="0.25"
              type="number"
              value={entry.hours}
            />
            <select
              aria-label="作業分類"
              className={styles.select}
              disabled={readOnly}
              onChange={(event) =>
                updateEntry(entry.id, { category: event.target.value as WorkLogCategory })
              }
              value={entry.category}
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="作業内容"
              className={styles.summaryInput}
              disabled={readOnly}
              onChange={(event) => updateEntry(entry.id, { summary: event.target.value })}
              placeholder="作業内容"
              value={entry.summary}
            />
            <button
              aria-label="明細を削除"
              className={`${styles.iconButton} ${styles.entryDelete}`}
              disabled={readOnly}
              onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}
              type="button"
            >
              <TrashIcon />
            </button>
          </div>
        );
      })}
    </section>
  );
}
