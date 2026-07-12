import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { DailyReport, Member } from "../../../types/schedule";
import { getDailyReportProjectName, type DailyReportSchedule } from "../model/dailyReports";

import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportReviewProps = {
  commenting: boolean;
  member: Member;
  onCommentChange: (value: string) => void;
  onSubmitComment: () => void;
  quickComment: string;
  report: DailyReport;
  schedules: DailyReportSchedule[];
};

/** 選択した日報の内容・明細・既存コメントとクイック返信欄を表示します。 */
export function TeamDailyReportReview({
  commenting,
  member,
  onCommentChange,
  onSubmitComment,
  quickComment,
  report,
  schedules,
}: TeamDailyReportReviewProps) {
  return (
    <tr className={styles.commentRow}>
      <td colSpan={7}>
        <div className={styles.reportReview}>
          <div className={styles.reviewContent}>
            <section>
              <strong>本日のまとめ</strong>
              <MarkdownPreview content={report.summary || "_未入力_"} />
            </section>
            <section>
              <strong>課題・相談事項</strong>
              <MarkdownPreview content={report.blockers || "_なし_"} />
            </section>
            <section>
              <strong>翌日の予定</strong>
              <MarkdownPreview content={report.nextPlan || "_未入力_"} />
            </section>
          </div>
          <div className={styles.reviewEntries}>
            <strong>作業明細</strong>
            {report.entries.map((entry) => (
              <div key={entry.id}>
                <span>{getDailyReportProjectName(entry.projectId, schedules)}</span>
                <p>{entry.summary}</p>
                <b>{entry.hours}h</b>
              </div>
            ))}
          </div>
          <div className={styles.reviewComments}>
            <strong>コメント {report.comments.length}件</strong>
            {report.comments.map((comment) => (
              <article key={comment.id}>
                <header>
                  <strong>{comment.authorName}</strong>
                  <time>{new Date(comment.createdAt).toLocaleString("ja-JP")}</time>
                </header>
                <MarkdownPreview content={comment.body} />
              </article>
            ))}
          </div>
          <div className={styles.quickComment}>
            <div>
              <strong>{member.name}の日報へコメント</strong>
              <span>内容を確認してフィードバックできます</span>
            </div>
            <textarea
              aria-label={`${member.name}へのコメント`}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="確認事項やフィードバックをMarkdownで入力"
              value={quickComment}
            />
            <button
              disabled={!quickComment.trim() || commenting}
              onClick={onSubmitComment}
              type="button"
            >
              コメントを送信
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
