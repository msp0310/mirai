import { useMemo } from "react";

import { getProgressStats } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  Project,
  ScheduleChangeLog,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import { BurndownChart } from "../../status/components/BurndownChart";
import { ScheduleChangeAnalysis } from "./ScheduleChangeAnalysis";

type AnalysisPanelProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  changeLogs: ScheduleChangeLog[];
  onCaptureBaseline: () => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  project: Project;
  tasks: ScheduleTask[];
};

/** 案件の進捗、日程変更、リスクを判断するための分析画面です。 */
export function AnalysisPanel({
  calendar,
  calendarAware,
  changeLogs,
  onCaptureBaseline,
  onSelectTask,
  project,
  tasks,
}: AnalysisPanelProps) {
  const stats = useMemo(() => getProgressStats(tasks), [tasks]);
  const scheduleChanges = useMemo(
    () => changeLogs.filter((log) => log.field === "start" || log.field === "end"),
    [changeLogs],
  );
  const changedTaskCount = useMemo(
    () => new Set(scheduleChanges.map((log) => log.taskId)).size,
    [scheduleChanges],
  );
  const delayedTasks = useMemo(
    () => tasks.filter((task) => task.type === "task" && task.status === "delayed"),
    [tasks],
  );
  const blockedTasks = useMemo(() => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return tasks.filter(
      (task) =>
        task.type === "task" &&
        (task.dependencies ?? []).some((dependencyId) => {
          const dependency = taskById.get(dependencyId);
          return dependency != null && dependency.status !== "done";
        }),
    );
  }, [tasks]);
  const riskTasks = useMemo(
    () =>
      [...delayedTasks, ...blockedTasks]
        .filter((task, index, rows) => rows.findIndex((item) => item.id === task.id) === index)
        .slice(0, 8),
    [blockedTasks, delayedTasks],
  );
  const baselineTaskCount = tasks.filter(
    (task) => task.type === "task" && task.baselineStart && task.baselineEnd,
  ).length;
  const baselineCapturedAt = tasks.find((task) => task.baselineCapturedAt)?.baselineCapturedAt;
  const hasBaseline = stats.total > 0 && baselineTaskCount === stats.total;
  const baselineDelayedTasks = tasks.filter(
    (task) => task.type === "task" && task.baselineEnd && task.end > task.baselineEnd,
  );
  const maximumBaselineDelay = baselineDelayedTasks.reduce(
    (maximum, task) => Math.max(maximum, getDateDiffDays(task.baselineEnd ?? task.end, task.end)),
    0,
  );

  return (
    <section className="analysis-page" aria-label="プロジェクト分析">
      <header className="analysis-header">
        <div>
          <span>{project.workspace}</span>
          <h2>プロジェクト分析</h2>
          <p>進捗・日程変更・リスクを案件単位で確認します。</p>
        </div>
        <div className="analysis-header-meta">
          <strong>
            {project.rangeStart} - {project.rangeEnd}
          </strong>
          <span>
            {hasBaseline && baselineCapturedAt
              ? `基準計画 ${formatDate(baselineCapturedAt)}`
              : baselineTaskCount > 0
                ? `基準計画 一部設定（${baselineTaskCount}/${stats.total}件）`
                : "基準計画 未設定"}
          </span>
        </div>
      </header>

      <div className={`analysis-data-status ${hasBaseline ? "ready" : "warning"}`}>
        <span>
          <b>実績</b>
          タスク状態・進捗・日程変更は最新入力値
        </span>
        <span>
          <b>予測</b>
          バーンダウンは現在進捗からの線形補間
        </span>
        <span>
          <b>比較基準</b>
          {hasBaseline ? "基準計画を設定済み" : "未設定のため参考線で表示"}
        </span>
        {!hasBaseline ? (
          <button onClick={onCaptureBaseline} type="button">
            基準計画を設定
          </button>
        ) : null}
      </div>

      <div className="analysis-kpi-grid">
        <AnalysisKpi
          label="対象タスク"
          value={`${stats.total}件`}
          detail={`${stats.completed}件完了`}
          tone="blue"
        />
        <AnalysisKpi
          label="平均進捗"
          value={`${stats.progress}%`}
          detail={`${stats.completed} / ${stats.total}件完了`}
          tone="teal"
        />
        <AnalysisKpi
          label="日程変更"
          value={`${scheduleChanges.length}件`}
          detail={`${changedTaskCount}タスクに変更`}
          tone={scheduleChanges.length > 0 ? "orange" : "teal"}
        />
        <AnalysisKpi
          label="要確認タスク"
          value={`${riskTasks.length}件`}
          detail={`遅延 ${delayedTasks.length} / 前提未完了 ${blockedTasks.length}`}
          tone={riskTasks.length > 0 ? "orange" : "teal"}
        />
      </div>

      <div className="analysis-main-grid">
        <BurndownChart
          calendar={calendar}
          calendarAware={calendarAware}
          baselineCapturedAt={baselineCapturedAt}
          hasBaseline={hasBaseline}
          onCaptureBaseline={onCaptureBaseline}
          projectEnd={project.rangeEnd}
          projectStart={project.rangeStart}
          tasks={tasks}
        />
        <section className="dashboard-panel analysis-risk-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>要確認タスク</h2>
              <span>遅延・前提未完了</span>
            </div>
            <strong>{riskTasks.length}件</strong>
          </div>
          <div className="analysis-risk-list">
            {riskTasks.map((task) => (
              <button
                className="analysis-risk-row"
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                type="button"
              >
                <span className={task.status === "delayed" ? "delayed" : "blocked"}>
                  {task.status === "delayed" ? "遅延" : "前提"}
                </span>
                <strong>{task.title}</strong>
                <small>
                  {formatDate(task.start)} - {formatDate(task.end)}
                </small>
              </button>
            ))}
            {riskTasks.length === 0 ? (
              <div className="analysis-empty">要確認タスクはありません。</div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="analysis-bottom-grid">
        <ScheduleChangeAnalysis changeLogs={changeLogs} onSelectTask={onSelectTask} tasks={tasks} />
        <section className="dashboard-panel analysis-baseline-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>基準計画</h2>
              <span>現在計画との比較対象</span>
            </div>
            <strong>{baselineTaskCount}件</strong>
          </div>
          <div className="analysis-baseline-content">
            <p>
              {baselineCapturedAt
                ? `最終設定 ${formatDate(baselineCapturedAt)}`
                : "まだ基準計画が設定されていません。"}
            </p>
            <small>
              {hasBaseline
                ? `終了日超過 ${baselineDelayedTasks.length}件 / 最大 +${maximumBaselineDelay}日`
                : "基準計画を設定すると、ガント上で予定変更を比較できます。"}
            </small>
          </div>
        </section>
      </div>
    </section>
  );
}

function AnalysisKpi({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "blue" | "orange" | "teal";
  value: string;
}) {
  return (
    <article className={`analysis-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function formatDate(value: string) {
  if (value.length >= 10) {
    return value.slice(0, 10).replaceAll("-", "/");
  }
  return value;
}

function getDateDiffDays(before: string, after: string) {
  const beforeDate = new Date(`${before}T00:00:00Z`);
  const afterDate = new Date(`${after}T00:00:00Z`);
  return Math.round((afterDate.getTime() - beforeDate.getTime()) / 86_400_000);
}
