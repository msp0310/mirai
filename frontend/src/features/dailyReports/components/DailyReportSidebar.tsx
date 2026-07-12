import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { AuthUser } from "../../../data/authRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport } from "../../../types/schedule";
import { getDailyReportProjectActuals } from "../model/dailyReports";

import * as styles from "./DailyReportPage.css";

type DailyReportSidebarProps = {
  comment: string;
  currentUser: AuthUser;
  onAddComment: () => void;
  onCommentChange: (value: string) => void;
  report: DailyReport;
  schedules: ScheduleSnapshot[];
};

/** 案件実績への反映見込みと、提出済み日報へのコメントを表示します。 */
export function DailyReportSidebar({
  comment,
  currentUser,
  onAddComment,
  onCommentChange,
  report,
  schedules,
}: DailyReportSidebarProps) {
  const actuals = getDailyReportProjectActuals(report.entries, schedules);
  return (
    <aside className={styles.editorSide}>
      <section className={styles.actualSummary}>
        <strong>案件実績への反映</strong>
        {[...actuals.totals].map(([projectId, hours]) => (
          <div key={projectId}>
            <span>
              {schedules.find((schedule) => schedule.project.id === projectId)?.project.workspace ??
                projectId}
            </span>
            <b>
              {hours}h
              {actuals.plans.get(projectId) ? ` / 予定${actuals.plans.get(projectId)}h` : ""}
            </b>
          </div>
        ))}
        {actuals.exceeded ? (
          <span className={styles.actualWarning}>予定工数を超過している明細があります。</span>
        ) : null}
      </section>
      <section className={styles.comments}>
        <h3>コメント</h3>
        {report.comments.map((item) => (
          <article className={styles.comment} key={item.id}>
            <header>
              <strong>{item.authorName}</strong>
              <time>{new Date(item.createdAt).toLocaleString("ja-JP")}</time>
            </header>
            <MarkdownPreview content={item.body} />
          </article>
        ))}
        {report.comments.length === 0 ? (
          <span className={styles.empty}>コメントはありません。</span>
        ) : null}
        <textarea
          aria-label="日報コメント"
          className={styles.commentInput}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder={`${currentUser.name}としてコメント`}
          value={comment}
        />
        <button
          className={styles.secondaryButton}
          disabled={!comment.trim() || report.version === 0}
          onClick={onAddComment}
          type="button"
        >
          コメントを追加
        </button>
      </section>
    </aside>
  );
}
