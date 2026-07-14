import { useMemo } from "react";

import { BurndownChart } from "../../../components/charts/BurndownChart";
import { getProgressStats } from "../../../lib/schedule";
import type {
  CalendarDefinition,
  Project,
  ProjectWorkLog,
  ScheduleChangeLog,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import { buildProjectKpis, projectKpiTargets } from "../model/projectKpis";
import { ScheduleChangeAnalysis } from "./ScheduleChangeAnalysis";

type AnalysisPanelProps = {
  asOfDate: string;
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
  workLogs: ProjectWorkLog[];
};

/** 案件の進捗、日程変更、リスクを判断するための分析画面です。 */
export function AnalysisPanel({
  asOfDate,
  calendar,
  calendarAware,
  changeLogs,
  onCaptureBaseline,
  onSelectTask,
  project,
  tasks,
  workLogs,
}: AnalysisPanelProps) {
  const stats = useMemo(() => getProgressStats(tasks), [tasks]);
  const kpis = useMemo(
    () => buildProjectKpis({ asOfDate, calendar, calendarAware, changeLogs, tasks, workLogs }),
    [asOfDate, calendar, calendarAware, changeLogs, tasks, workLogs],
  );
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
          タスク状態・進捗・完了日・作業時間は最新入力値
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

      <section className="analysis-metric-section" aria-label="プロジェクトKPI">
        <div className="analysis-section-heading">
          <div>
            <h2>KPI</h2>
            <span>目標と計画に対する案件実績</span>
          </div>
          <small>{formatDate(asOfDate)} 時点</small>
        </div>
        <div className="analysis-project-kpi-grid">
          <ProjectKpiCard
            detail={
              kpis.delivery.completedCount > 0
                ? kpis.delivery.evaluatedCount > 0
                  ? `期限内 ${kpis.delivery.onTimeCount}/${kpis.delivery.evaluatedCount}件${
                      kpis.delivery.missingCompletionCount > 0
                        ? `・完了日未入力 ${kpis.delivery.missingCompletionCount}件`
                        : ""
                    }`
                  : `完了日未入力 ${kpis.delivery.missingCompletionCount}件`
                : "完了タスク・マイルストーンなし"
            }
            label="納期遵守率"
            target={`目標 ${projectKpiTargets.onTimeDeliveryRate}%以上`}
            tone={getDeliveryTone(kpis.delivery.rate)}
            value={formatPercent(kpis.delivery.rate)}
          />
          <ProjectKpiCard
            detail={
              kpis.effort.hasActual
                ? `予定 ${formatHours(kpis.effort.plannedHoursToDate)} / 実績 ${formatHours(
                    kpis.effort.actualHours,
                  )}`
                : `予定 ${formatHours(kpis.effort.plannedHoursToDate)} / 実績工数未入力`
            }
            label="工数予実差"
            target={`目標 ±${projectKpiTargets.effortVarianceRate}%以内`}
            tone={getEffortTone(kpis.effort.varianceRate)}
            value={formatSignedPercent(kpis.effort.varianceRate)}
          />
          <ProjectKpiCard
            detail={`計画 ${kpis.progress.plannedRate}% / 実績 ${kpis.progress.actualRate}%`}
            label="進捗達成率"
            target={`目標 ${projectKpiTargets.progressAchievementRate}%以上`}
            tone={getProgressTone(kpis.progress.achievementRate)}
            value={formatPercent(kpis.progress.achievementRate)}
          />
        </div>
      </section>

      <section className="analysis-metric-section" aria-label="プロジェクトサマリー">
        <div className="analysis-section-heading">
          <div>
            <h2>プロジェクトサマリー</h2>
            <span>現在のタスク状況</span>
          </div>
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
      </section>

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

type AnalysisTone = "blue" | "orange" | "teal";

function ProjectKpiCard({
  detail,
  label,
  target,
  tone,
  value,
}: {
  detail: string;
  label: string;
  target: string;
  tone: AnalysisTone;
  value: string;
}) {
  return (
    <article className={`analysis-project-kpi ${tone}`}>
      <div>
        <span>{label}</span>
        <em>{target}</em>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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
  tone: AnalysisTone;
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

function getDeliveryTone(rate: number | null): AnalysisTone {
  if (rate == null) {
    return "blue";
  }
  return rate >= projectKpiTargets.onTimeDeliveryRate ? "teal" : "orange";
}

function getEffortTone(rate: number | null): AnalysisTone {
  if (rate == null) {
    return "blue";
  }
  return Math.abs(rate) <= projectKpiTargets.effortVarianceRate ? "teal" : "orange";
}

function getProgressTone(rate: number | null): AnalysisTone {
  if (rate == null) {
    return "blue";
  }
  return rate >= projectKpiTargets.progressAchievementRate ? "teal" : "orange";
}

function formatPercent(value: number | null) {
  return value == null ? "未評価" : `${value}%`;
}

function formatSignedPercent(value: number | null) {
  if (value == null) {
    return "未評価";
  }
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatHours(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}h`;
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
