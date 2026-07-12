import { formatShortDate } from "../../../../lib/schedule";
import type { ProjectLifecycleStatus } from "../../../../types/schedule";
import type { ProjectPortfolioItem } from "../projectPortfolioTypes";

type PortfolioSummaryProps = {
  allItemCount: number;
  attentionProjectCount: number;
  averageProgress: number;
  completedTasks: number;
  filteredItemCount: number;
  hasActiveFilter: boolean;
  lifecycleCounts: Record<ProjectLifecycleStatus, number>;
  nextMilestone?: {
    milestone: ProjectPortfolioItem["nextMilestone"];
    project: ProjectPortfolioItem["project"];
  };
  totalTasks: number;
};

/** 進行中案件を基準に、チームの案件状況を要約します。 */
export function PortfolioSummary({
  allItemCount,
  attentionProjectCount,
  averageProgress,
  completedTasks,
  filteredItemCount,
  hasActiveFilter,
  lifecycleCounts,
  nextMilestone,
  totalTasks,
}: PortfolioSummaryProps) {
  return (
    <div className="portfolio-summary">
      <SummaryCard
        detail={`計画${lifecycleCounts.planning} / 進行${lifecycleCounts.inProgress} / 完了${lifecycleCounts.completed}`}
        label="管理中プロジェクト"
        value={hasActiveFilter ? `${filteredItemCount}/${allItemCount}件` : `${allItemCount}件`}
      />
      <SummaryCard
        detail={`${completedTasks} / ${totalTasks} タスク完了`}
        label="平均進捗"
        tone={averageProgress >= 70 ? "good" : "blue"}
        value={`${averageProgress}%`}
      />
      <SummaryCard
        detail={
          attentionProjectCount > 0
            ? "遅延または進捗35%未満の案件があります"
            : "要対応案件はありません"
        }
        label="要対応案件"
        tone={attentionProjectCount > 0 ? "hot" : "good"}
        value={`${attentionProjectCount}件`}
      />
      <SummaryCard
        detail={nextMilestone?.project.workspace ?? "予定中のマイルストーンなし"}
        label="次の節目"
        value={nextMilestone ? formatShortDate(nextMilestone.milestone.start) : "-"}
      />
    </div>
  );
}

function SummaryCard({
  detail,
  label,
  tone = "blue",
  value,
}: {
  detail: string;
  label: string;
  tone?: "blue" | "good" | "hot";
  value: string;
}) {
  return (
    <article className={`portfolio-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
