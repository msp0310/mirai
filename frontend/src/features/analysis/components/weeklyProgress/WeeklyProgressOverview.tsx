import {
  formatWeekLabel,
  type WeeklyProgressMetrics,
  type WeeklyProgressRow,
} from "../../model/weeklyProgress";

type WeeklyProgressOverviewProps = {
  currentWeek: WeeklyProgressRow | undefined;
  currentWeekIndex: number;
  metrics: WeeklyProgressMetrics;
  totalWeeks: number;
};

/** 案件全体と今週時点の計画差を、会議冒頭で読める指標にまとめます。 */
export function WeeklyProgressOverview({
  currentWeek,
  currentWeekIndex,
  metrics,
  totalWeeks,
}: WeeklyProgressOverviewProps) {
  return (
    <>
      <div className="weekly-progress-heading">
        <div>
          <h2>週次進捗サマリー</h2>
          <p>予定終了週ごとに、完了・進行中・遅延の状況を集計しています。</p>
        </div>
        <div className="weekly-progress-meta">
          <strong>全{totalWeeks}週</strong>
          <span>
            現在 {currentWeekIndex + 1}週目 / 完了 {metrics.totalCompleted}件 / 遅延{" "}
            {metrics.delayedCount}件
          </span>
        </div>
      </div>

      <div className="weekly-progress-overview" aria-label="プロジェクト全体の計画と実績">
        <div>
          <span>全タスク</span>
          <strong>{metrics.totalTasks}件</strong>
        </div>
        <div>
          <span>
            {currentWeek ? `${formatWeekLabel(currentWeek.start)}までの計画完了` : "計画完了"}
          </span>
          <strong>{metrics.plannedCompletionCount}件</strong>
        </div>
        <div>
          <span>完了済み</span>
          <strong>{metrics.totalCompleted}件</strong>
        </div>
        <div>
          <span>未完了</span>
          <strong>{metrics.totalIncomplete}件</strong>
        </div>
        <div>
          <span>全体完了率</span>
          <strong>{metrics.actualCompletionRate}%</strong>
        </div>
        <div
          className={
            metrics.completionGap < 0 ? "behind" : metrics.completionGap > 0 ? "ahead" : "on-track"
          }
        >
          <span>計画との差</span>
          <strong>
            {metrics.completionGap > 0 ? "+" : ""}
            {metrics.completionGap}pt
          </strong>
        </div>
      </div>
    </>
  );
}
