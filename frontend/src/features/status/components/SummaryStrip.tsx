import { useState } from "react";

import {
  daysInclusive,
  formatDateWithWeekday,
  formatShortDate,
  getWorkingDays,
  statusLabels,
} from "../../../lib/schedule";
import type { ScheduleHealthIssue, ScheduleHealthReport } from "../../../lib/scheduleHealth";
import type {
  CalendarDefinition,
  Member,
  ProgressStats,
  Project,
  ResourceRowModel,
  ScheduleTask,
} from "../../../types/schedule";
import { BurndownChart } from "./BurndownChart";

type SummaryStripProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  onCaptureBaseline: () => void;
  healthReport: ScheduleHealthReport;
  members: Member[];
  onOpenHealthIssue: (issue: ScheduleHealthIssue) => void;
  onSelectTask: (taskId: string) => void;
  project: Project;
  resourceRows: ResourceRowModel[];
  stats: ProgressStats;
  tasks: ScheduleTask[];
};

/** 選択案件の進捗とリスクを短く表示するサマリー帯です。 */
export function SummaryStrip({
  calendar,
  calendarAware,
  healthReport,
  members,
  onCaptureBaseline,
  onOpenHealthIssue,
  onSelectTask,
  project,
  resourceRows,
  stats,
  tasks,
}: SummaryStripProps) {
  const [showAllHealthIssues, setShowAllHealthIssues] = useState(false);
  const actionableTasks = tasks.filter((task) => task.type === "task");
  const phases = tasks.filter((task) => task.type === "phase");
  const milestones = tasks
    .filter((task) => task.type === "milestone")
    .toSorted((a, b) => a.start.localeCompare(b.start));
  const nextOpenMilestone = milestones.find((task) => task.status !== "done");
  const delayedTasks = actionableTasks
    .filter((task) => task.status === "delayed")
    .toSorted((a, b) => a.end.localeCompare(b.end));
  const blockedTasks = actionableTasks
    .filter((task) =>
      (task.dependencies ?? []).some((dependencyId) => {
        const dependency = tasks.find((item) => item.id === dependencyId);
        return dependency != null && dependency.status !== "done";
      }),
    )
    .slice(0, 4);
  const highLoadRows = resourceRows
    .filter((row) => row.utilization >= 80)
    .toSorted((a, b) => b.utilization - a.utilization)
    .slice(0, 4);
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const totalEffort = actionableTasks.reduce(
    (sum, task) =>
      sum + (task.effortHours ?? getWorkingDays(task.start, task.end, calendar, calendarAware) * 8),
    0,
  );
  const completedEffort = actionableTasks.reduce(
    (sum, task) =>
      sum +
      ((task.effortHours ?? getWorkingDays(task.start, task.end, calendar, calendarAware) * 8) *
        task.progress) /
        100,
    0,
  );
  const forecastTone =
    healthReport.dangerCount > 0 ||
    stats.delayed > 0 ||
    blockedTasks.length > 0 ||
    highLoadRows.some((row) => row.utilization >= 80)
      ? "attention"
      : stats.progress >= 70
        ? "good"
        : "neutral";
  const projectDays = daysInclusive(project.rangeStart, project.rangeEnd);
  const workingDays = getWorkingDays(project.rangeStart, project.rangeEnd, calendar, calendarAware);
  const visibleHealthIssues = showAllHealthIssues
    ? healthReport.issues
    : healthReport.issues.slice(0, 5);
  const hiddenHealthIssueCount = Math.max(healthReport.issues.length - 5, 0);
  const baselineCapturedAt = tasks.find((task) => task.baselineCapturedAt)?.baselineCapturedAt;
  const hasBaseline = tasks.some((task) => task.baselineStart && task.baselineEnd);

  return (
    <section className="status-dashboard" aria-label="プロジェクト概要">
      <div className="summary-strip">
        <SummaryCard
          label="プロジェクト全体"
          value={
            healthReport.dangerCount > 0
              ? "要修正"
              : forecastTone === "attention"
                ? "要注意"
                : "順調"
          }
          tone={forecastTone}
          detail={
            healthReport.dangerCount > 0
              ? `健全性エラー ${healthReport.dangerCount}件 / スコア ${healthReport.score}`
              : stats.delayed > 0
                ? `遅延 ${stats.delayed}件 / 高負荷 ${highLoadRows.length}名`
                : blockedTasks.length > 0
                  ? `前提未完了 ${blockedTasks.length}件 / 高負荷 ${highLoadRows.length}名`
                  : `稼働日 ${workingDays}日 / 全${projectDays}日`
          }
        />
        <SummaryCard
          label="遅延タスク"
          value={`${stats.delayed} / ${stats.total}`}
          tone={stats.delayed > 0 ? "hot" : "good"}
          detail={delayedTasks[0] ? `${delayedTasks[0].title} を確認` : "期限超過タスクなし"}
        />
        <SummaryCard
          label="総作業量"
          value={`${Math.round(totalEffort)}h`}
          tone="neutral"
          detail={`消化 ${Math.round(completedEffort)}h / 進捗 ${stats.progress}%`}
          sparkline
        />
        <SummaryCard
          label="次のマイルストーン"
          value={nextOpenMilestone?.title ?? project.nextMilestone.title}
          tone="blue"
          detail={formatDateWithWeekday(nextOpenMilestone?.start ?? project.nextMilestone.date)}
        />
        <SummaryCard
          label="完了率"
          value={`${completionRate}%`}
          tone={completionRate >= 70 ? "good" : "blue"}
          detail={`${stats.completed}件が完了`}
          progressValue={completionRate}
        />
      </div>

      <div className="dashboard-grid">
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
        <section className="dashboard-panel phase-panel">
          <PanelHeader title="工程別進捗" detail={`${phases.length}工程`} />
          <div className="phase-list">
            {phases.map((phase) => (
              <button
                className="phase-row"
                key={phase.id}
                onClick={() => onSelectTask(phase.id)}
                type="button"
              >
                <div>
                  <strong>{phase.title}</strong>
                  <span className={`status-pill ${phase.status}`}>
                    <span />
                    {statusLabels[phase.status]}
                  </span>
                </div>
                <div className="phase-progress">
                  <span>{phase.progress}%</span>
                  <div>
                    <span style={{ width: `${phase.progress}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-panel risk-panel">
          <PanelHeader title="要確認" detail={`${delayedTasks.length + blockedTasks.length}件`} />
          <div className="risk-list">
            {[...delayedTasks, ...blockedTasks]
              .filter(
                (task, index, self) => self.findIndex((item) => item.id === task.id) === index,
              )
              .slice(0, 5)
              .map((task) => (
                <button
                  className={`risk-row ${task.status}`}
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  type="button"
                >
                  <span>{task.status === "delayed" ? "遅延" : "前提"}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {formatShortDate(task.start)} - {formatShortDate(task.end)}
                    </small>
                  </div>
                </button>
              ))}
            {delayedTasks.length === 0 && blockedTasks.length === 0 ? (
              <EmptyDashboardRow label="要確認タスクはありません" />
            ) : null}
          </div>
        </section>

        <section className="dashboard-panel health-panel">
          <PanelHeader
            title="健全性チェック"
            detail={`${healthReport.statusLabel} / ${healthReport.score}点`}
          />
          <div className="health-score-row">
            <div
              className={`health-score-ring ${getHealthTone(healthReport)}`}
              aria-label={`健全性スコア ${healthReport.score}`}
            >
              {healthReport.score}
            </div>
            <div>
              <strong>{healthReport.statusLabel}</strong>
              <small>
                エラー{healthReport.dangerCount} / 警告{healthReport.warningCount}
              </small>
            </div>
          </div>
          <div className="health-list">
            {visibleHealthIssues.map((issue) => (
              <HealthIssueRow issue={issue} key={issue.id} onOpenIssue={onOpenHealthIssue} />
            ))}
            {hiddenHealthIssueCount > 0 ? (
              <button
                className="health-list-more"
                onClick={() => setShowAllHealthIssues((current) => !current)}
                type="button"
              >
                {showAllHealthIssues ? "主要5件に戻す" : `残り${hiddenHealthIssueCount}件を表示`}
              </button>
            ) : null}
            {healthReport.issues.length === 0 ? (
              <EmptyDashboardRow label="データ整合性の問題はありません" />
            ) : null}
          </div>
        </section>

        <section className="dashboard-panel milestone-dashboard-panel">
          <PanelHeader title="マイルストーン" detail={`${milestones.length}件`} />
          <div className="dashboard-timeline">
            {milestones.slice(0, 5).map((milestone) => (
              <button
                className={`timeline-item ${milestone.status}`}
                key={milestone.id}
                onClick={() => onSelectTask(milestone.id)}
                type="button"
              >
                <span>{formatShortDate(milestone.start)}</span>
                <div>
                  <strong>{milestone.title}</strong>
                  <small>{statusLabels[milestone.status]}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-panel load-panel">
          <PanelHeader title="チーム負荷" detail={`${members.length}名`} />
          <div className="load-list">
            {resourceRows.slice(0, 6).map((row) => (
              <div className="load-row" key={row.member.id}>
                <div>
                  <strong>{row.member.name}</strong>
                  <small>{row.member.role}</small>
                </div>
                <div className={`load-meter load-${getLoadTone(row.utilization)}`}>
                  <span>{row.utilization}%</span>
                  <div>
                    <span style={{ width: `${Math.min(row.utilization, 120)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

type SummaryCardProps = {
  detail: string;
  label: string;
  progressValue?: number;
  sparkline?: boolean;
  tone: "attention" | "hot" | "good" | "neutral" | "blue";
  value: string;
};

function SummaryCard({ detail, label, progressValue, sparkline, tone, value }: SummaryCardProps) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sparkline ? (
        <svg className="sparkline" viewBox="0 0 120 28" aria-hidden="true">
          <path d="M4 21 L18 18 L31 19 L44 14 L58 16 L70 10 L82 14 L95 6 L108 13 L116 9" />
        </svg>
      ) : null}
      {progressValue != null ? (
        <div className="mini-progress">
          <span style={{ width: `${progressValue}%` }} />
        </div>
      ) : null}
      <small>{detail}</small>
    </article>
  );
}

function PanelHeader({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="dashboard-panel-header">
      <h2>{title}</h2>
      <span>{detail}</span>
    </div>
  );
}

function EmptyDashboardRow({ label }: { label: string }) {
  return <div className="empty-dashboard-row">{label}</div>;
}

function HealthIssueRow({
  issue,
  onOpenIssue,
}: {
  issue: ScheduleHealthIssue;
  onOpenIssue: (issue: ScheduleHealthIssue) => void;
}) {
  return (
    <button
      className={`health-row ${issue.severity}`}
      onClick={() => onOpenIssue(issue)}
      type="button"
      aria-label={`${issue.title}を${getHealthActionLabel(issue)}で確認`}
    >
      <span className="health-row-badge">{getHealthLabel(issue.severity)}</span>
      <div>
        <strong>{issue.title}</strong>
        <small>{issue.detail}</small>
      </div>
      <span className="health-row-action">{getHealthActionLabel(issue)}</span>
    </button>
  );
}

function getLoadTone(value: number) {
  if (value >= 90) {
    return "danger";
  }
  if (value >= 80) {
    return "warning";
  }
  return "good";
}

function getHealthLabel(severity: ScheduleHealthIssue["severity"]) {
  if (severity === "danger") {
    return "修正";
  }
  if (severity === "warning") {
    return "確認";
  }
  return "情報";
}

function getHealthActionLabel(issue: ScheduleHealthIssue) {
  if (issue.taskId) {
    return "ガント";
  }
  if (issue.category === "calendar") {
    return "カレンダー";
  }
  if (issue.category === "load") {
    return "リソース";
  }
  if (issue.category === "assign") {
    return "メンバー";
  }
  return "ガント";
}

function getHealthTone(report: ScheduleHealthReport) {
  if (report.dangerCount > 0) {
    return "danger";
  }
  if (report.warningCount > 0) {
    return "warning";
  }
  return "good";
}
