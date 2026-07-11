import { useMemo } from "react";
import type { CalendarDefinition, ScheduleTask } from "../../../types/schedule";
import {
  addDays,
  daysInclusive,
  diffDays,
  formatShortDate,
  getWorkingDays,
  parseDate,
  toDateKey,
} from "../../../lib/schedule";

type BurndownChartProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  projectEnd: string;
  projectStart: string;
  tasks: ScheduleTask[];
};

type BurndownPoint = {
  actual: number;
  date: string;
  planned: number;
};

const chartWidth = 760;
const chartHeight = 236;
const chartPadding = { bottom: 28, left: 44, right: 16, top: 18 };

/** 案件の計画残タスク数と、現在の進捗から見た残タスク数を比較します。 */
export function BurndownChart({
  calendar,
  calendarAware,
  projectEnd,
  projectStart,
  tasks,
}: BurndownChartProps) {
  const points = useMemo(
    () => buildBurndownPoints(tasks, projectStart, projectEnd, calendar, calendarAware),
    [calendar, calendarAware, projectEnd, projectStart, tasks],
  );
  const totalTasks = points[0]?.planned ?? 0;
  const currentRemaining = points[points.length - 1]?.actual ?? 0;
  const maxTasks = Math.max(totalTasks, ...points.map((point) => point.actual), 1);
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const plannedPath = toChartPath(points, "planned", maxTasks, plotWidth, plotHeight);
  const actualPath = toChartPath(points, "actual", maxTasks, plotWidth, plotHeight);

  return (
    <section className="dashboard-panel burndown-panel">
      <div className="dashboard-panel-header">
        <div>
          <h2>バーンダウン</h2>
          <p>計画と現在進捗から見た残タスク数</p>
        </div>
        <div className="burndown-summary">
          <strong>{formatTasks(currentRemaining)}</strong>
          <span>現在の残タスク</span>
        </div>
      </div>
      <div className="burndown-legend" aria-label="バーンダウンの凡例">
        <span><i className="burndown-legend-line planned" />計画</span>
        <span><i className="burndown-legend-line actual" />現在進捗</span>
      </div>
      <div className="burndown-chart-wrap">
        <svg
          aria-label="計画と現在進捗から見た残タスク数の推移"
          className="burndown-chart"
          role="img"
          viewBox={"0 0 " + chartWidth + " " + chartHeight}
        >
          {yTicks.map((tick) => {
            const y = chartPadding.top + plotHeight * (1 - tick);
            return (
              <g key={tick}>
                <line
                  className="burndown-grid-line"
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={y}
                  y2={y}
                />
                <text className="burndown-axis-label" x={chartPadding.left - 8} y={y + 4}>
                  {formatTasks(maxTasks * tick)}
                </text>
              </g>
            );
          })}
          <path className="burndown-path planned" d={plannedPath} />
          <path className="burndown-path actual" d={actualPath} />
          {points.map((point, index) => {
            const x = getChartX(index, points.length, plotWidth);
            const y = getChartY(point.actual, maxTasks, plotHeight);
            return (
              <circle className="burndown-point" cx={x} cy={y} key={point.date} r="3">
                <title>{formatShortDate(point.date) + ": " + formatTasks(point.actual)}</title>
              </circle>
            );
          })}
          {points.map((point, index) => {
            if (index !== 0 && index !== points.length - 1 && index % 2 !== 0) return null;
            return (
              <text
                className="burndown-date-label"
                key={point.date + "-label"}
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                x={getChartX(index, points.length, plotWidth)}
                y={chartHeight - 7}
              >
                {formatShortDate(point.date)}
              </text>
            );
          })}
        </svg>
      </div>
      <small className="burndown-note">現在のタスク進捗をもとに残タスク数を表示しています。実績履歴は順次蓄積します。</small>
    </section>
  );
}

function buildBurndownPoints(
  tasks: ScheduleTask[],
  projectStart: string,
  projectEnd: string,
  calendar: CalendarDefinition,
  calendarAware: boolean,
): BurndownPoint[] {
  const actionable = tasks.filter((task) => task.type === "task");
  const totalTasks = actionable.length;
  const projectWorkingDays = Math.max(getWorkingDays(projectStart, projectEnd, calendar, calendarAware), 1);
  const currentRemaining = actionable.reduce((sum, task) => sum + (1 - task.progress / 100), 0);
  const today = toDateKey(new Date());
  const actualDate = today < projectStart ? projectStart : today > projectEnd ? projectEnd : today;
  const actualDateSpan = Math.max(diffDays(projectStart, actualDate), 1);
  const projectDateSpan = Math.max(diffDays(projectStart, projectEnd), 1);
  const points: BurndownPoint[] = [];
  const pointCount = Math.min(Math.max(Math.ceil(daysInclusive(projectStart, projectEnd) / 7), 2), 14);

  for (let index = 0; index < pointCount; index += 1) {
    const ratio = index / (pointCount - 1);
    const date = index === pointCount - 1
      ? projectEnd
      : toDateKey(addDays(parseDate(projectStart), Math.round(projectDateSpan * ratio)));
    const elapsedWorkingDays = getWorkingDays(projectStart, date, calendar, calendarAware);
    const planned = totalTasks * Math.max(0, 1 - elapsedWorkingDays / projectWorkingDays);
    const actual = date <= actualDate
      ? totalTasks - (totalTasks - currentRemaining) * Math.min(Math.max(diffDays(projectStart, date) / actualDateSpan, 0), 1)
      : currentRemaining * Math.max(0, 1 - diffDays(actualDate, date) / Math.max(diffDays(actualDate, projectEnd), 1));
    points.push({ actual, date, planned });
  }
  return points;
}

function getChartX(index: number, pointCount: number, plotWidth: number) {
  return chartPadding.left + (pointCount <= 1 ? 0 : (plotWidth * index) / (pointCount - 1));
}

function getChartY(value: number, maxEffort: number, plotHeight: number) {
  return chartPadding.top + plotHeight * (1 - value / maxEffort);
}

function toChartPath(
  points: BurndownPoint[],
  key: "actual" | "planned",
  maxEffort: number,
  plotWidth: number,
  plotHeight: number,
) {
  return points
    .map((point, index) => {
      const x = getChartX(index, points.length, plotWidth);
      const y = getChartY(point[key], maxEffort, plotHeight);
      return (index === 0 ? "M" : "L") + x + " " + y;
    })
    .join(" ");
}

function formatTasks(value: number) {
  return Math.round(value) + "件";
}
