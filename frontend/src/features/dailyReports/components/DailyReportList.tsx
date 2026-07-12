import type { DailyReport } from "../../../types/schedule";
import { formatReportDate, sumDailyReportHours } from "../model/dailyReports";

import * as styles from "./DailyReportPage.css";

type DailyReportListProps = {
  message: string;
  onSelect: (report: DailyReport) => void;
  reports: DailyReport[];
  selectedId: string | null;
};

/** 自分の日報を日付順に選択する一覧です。 */
export function DailyReportList({ message, onSelect, reports, selectedId }: DailyReportListProps) {
  return (
    <aside className={styles.reportList} aria-label="日報一覧">
      <div className={styles.listHeading}>
        <strong>最近の日報</strong>
        <span>{reports.length}件</span>
      </div>
      {reports.map((report) => (
        <button
          className={`${styles.reportListItem} ${selectedId === report.id ? styles.reportListItemActive : ""}`}
          key={report.id}
          onClick={() => onSelect(report)}
          type="button"
        >
          <span className={styles.reportDate}>{formatReportDate(report.date)}</span>
          <strong>{report.summary.trim() || "未入力の日報"}</strong>
          <span className={styles.reportMeta}>
            <small>{report.status === "submitted" ? "提出済み" : "下書き"}</small>
            <small>{sumDailyReportHours(report.entries)}h</small>
            {report.unreadCommentCount ? <small>{report.unreadCommentCount}件未読</small> : null}
          </span>
        </button>
      ))}
      {reports.length === 0 ? <span className={styles.empty}>{message}</span> : null}
    </aside>
  );
}
