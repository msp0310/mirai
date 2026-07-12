import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportSummaryProps = {
  blockerCount: number;
  requiredMemberCount: number;
  requiredSubmitted: number;
  totalHours: number;
};

/** 選択日の提出状況、工数、相談事項を要約します。 */
export function TeamDailyReportSummary({
  blockerCount,
  requiredMemberCount,
  requiredSubmitted,
  totalHours,
}: TeamDailyReportSummaryProps) {
  return (
    <div className={styles.summaryGrid}>
      <SummaryCard
        accent="blue"
        icon={<CheckCircleIcon />}
        label="提出状況"
        value={
          requiredMemberCount > 0 ? `${requiredSubmitted} / ${requiredMemberCount}名` : "提出不要"
        }
      />
      <SummaryCard accent="green" icon={<ClockIcon />} label="報告工数" value={`${totalHours}h`} />
      <SummaryCard
        accent={blockerCount > 0 ? "orange" : "gray"}
        icon={<ExclamationTriangleIcon />}
        label="課題・相談あり"
        value={`${blockerCount}名`}
      />
    </div>
  );
}

function SummaryCard({
  accent,
  icon,
  label,
  value,
}: {
  accent: "blue" | "gray" | "green" | "orange";
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className={`${styles.summaryCard} ${styles.summaryAccents[accent]}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
