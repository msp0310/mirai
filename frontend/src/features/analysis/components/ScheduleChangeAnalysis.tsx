import { useMemo } from "react";
import type {
  ScheduleChangeLog,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";

export type ScheduleChangeAnalysisProps = {
  changeLogs: ScheduleChangeLog[];
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  tasks: ScheduleTask[];
};

/** APIに保存された日程変更を、影響の大きいタスク順で表示します。 */
export function ScheduleChangeAnalysis({
  changeLogs,
  onSelectTask,
  tasks,
}: ScheduleChangeAnalysisProps) {
  const taskNames = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks],
  );
  const scheduleChanges = useMemo(
    () => changeLogs.filter((log) => log.field === "start" || log.field === "end"),
    [changeLogs],
  );
  const rows = useMemo(() => {
    const grouped = new Map<
      string,
      { count: number; deltaDays: number; latest: string; title: string }
    >();
    scheduleChanges.forEach((log) => {
      const current = grouped.get(log.taskId) ?? {
        count: 0,
        deltaDays: 0,
        latest: log.changedAt,
        title: taskNames.get(log.taskId) ?? "削除されたタスク",
      };
      current.count += 1;
      current.deltaDays += Math.abs(log.deltaDays ?? 0);
      if (log.changedAt > current.latest) current.latest = log.changedAt;
      grouped.set(log.taskId, current);
    });
    return [...grouped.entries()]
      .map(([taskId, row]) => ({ taskId, ...row }))
      .sort((left, right) => right.count - left.count || right.deltaDays - left.deltaDays)
      .slice(0, 8);
  }, [scheduleChanges, taskNames]);

  return (
    <section className="schedule-change-analysis" aria-label="日程変更分析">
      <div className="schedule-change-analysis-heading">
        <div>
          <strong>日程変更が多いタスク</strong>
          <span>保存のたびに記録された開始日・終了日の変更</span>
        </div>
        <span>{scheduleChanges.length}件</span>
      </div>
      {rows.length > 0 ? (
        <div className="schedule-change-analysis-list">
          {rows.map((row) => (
            <button
              className="schedule-change-analysis-row"
              key={row.taskId}
              onClick={() => onSelectTask(row.taskId, "start")}
              type="button"
            >
              <span className="schedule-change-count">{row.count}回</span>
              <span className="schedule-change-task">{row.title}</span>
              <span className="schedule-change-detail">
                累計 {row.deltaDays}日 / 最終 {formatActivityDate(row.latest)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="schedule-change-analysis-empty">保存済みの日程変更はありません。</div>
      )}
    </section>
  );
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}
