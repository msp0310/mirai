import {
  ArrowRightIcon,
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport, Member } from "../../../types/schedule";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportsViewProps = {
  canManage: boolean;
  members: Member[];
  onComment: (reportId: string, body: string) => Promise<void>;
  onOpenReport: (report: DailyReport) => void;
  onRemind: (date: string, memberIds: string[]) => Promise<void>;
  reports: DailyReport[];
  schedules: ScheduleSnapshot[];
  teamName: string;
  todayKey: string;
};

/** チーム全員の日報提出状況と案件別実績を日付単位で確認します。 */
export function TeamDailyReportsView({
  canManage,
  members,
  onComment,
  onOpenReport,
  onRemind,
  reports,
  schedules,
  teamName,
  todayKey,
}: TeamDailyReportsViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [commentReportId, setCommentReportId] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const dateOptions = useMemo(
    () => [...new Set([todayKey, ...reports.map((report) => report.date)])].sort().reverse(),
    [reports, todayKey],
  );
  const reportsForDate = reports.filter((report) => report.date === selectedDate);
  const reportByMember = new Map(reportsForDate.map((report) => [report.memberId, report]));
  const submitted = reportsForDate.filter((report) => report.status === "submitted").length;
  const totalHours = reportsForDate.reduce((sum, report) => sum + sumHours(report), 0);
  const blockerCount = reportsForDate.filter((report) => report.blockers?.trim()).length;
  const missingMemberIds = members
    .filter((member) => !reportByMember.has(member.id))
    .map((member) => member.id);

  function moveDate(days: number) {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
    setSelectedMemberIds(new Set());
  }

  async function remindSelected() {
    if (selectedMemberIds.size === 0) return;
    setSending(true);
    try {
      await onRemind(selectedDate, [...selectedMemberIds]);
      setSelectedMemberIds(new Set());
    } finally {
      setSending(false);
    }
  }

  async function submitComment() {
    if (!commentReportId || !quickComment.trim()) return;
    setCommenting(true);
    try {
      await onComment(commentReportId, quickComment.trim());
      setQuickComment("");
      setCommentReportId(null);
    } finally {
      setCommenting(false);
    }
  }

  return (
    <section className={styles.teamView} aria-label="みんなの日報">
      <header className={styles.toolbar}>
        <div>
          <strong>{formatLongDate(selectedDate)}</strong>
          <span>{teamName}の作業内容と提出状況</span>
        </div>
        <div className={styles.toolbarActions}>
          {canManage && missingMemberIds.length > 0 ? (
            <button
              className={styles.remindButton}
              disabled={selectedMemberIds.size === 0 || sending}
              onClick={remindSelected}
              type="button"
            >
              <BellAlertIcon />
              {selectedMemberIds.size > 0
                ? `${selectedMemberIds.size}名へリマインド`
                : "未提出者を選択"}
            </button>
          ) : null}
          <div className={styles.dateNavigation} aria-label="日付移動">
            <button aria-label="前日" onClick={() => moveDate(-1)} type="button">
              <ChevronLeftIcon />
            </button>
            <button onClick={() => setSelectedDate(todayKey)} type="button">
              今日
            </button>
            <button aria-label="翌日" onClick={() => moveDate(1)} type="button">
              <ChevronRightIcon />
            </button>
          </div>
          <label className={styles.datePicker}>
            <span>対象日</span>
            <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
              {!dateOptions.includes(selectedDate) ? (
                <option value={selectedDate}>{formatLongDate(selectedDate)}</option>
              ) : null}
              {dateOptions.map((date) => (
                <option key={date} value={date}>
                  {formatLongDate(date)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <SummaryCard
          accent="blue"
          icon={<CheckCircleIcon />}
          label="提出状況"
          value={`${submitted} / ${members.length}名`}
        />
        <SummaryCard
          accent="green"
          icon={<ClockIcon />}
          label="報告工数"
          value={`${totalHours}h`}
        />
        <SummaryCard
          accent={blockerCount > 0 ? "orange" : "gray"}
          icon={<ExclamationTriangleIcon />}
          label="課題・相談あり"
          value={`${blockerCount}名`}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                {canManage && missingMemberIds.length > 0 ? (
                  <input
                    aria-label="未提出者をすべて選択"
                    checked={selectedMemberIds.size === missingMemberIds.length}
                    onChange={(event) =>
                      setSelectedMemberIds(
                        event.target.checked ? new Set(missingMemberIds) : new Set(),
                      )
                    }
                    type="checkbox"
                  />
                ) : null}
                メンバー
              </th>
              <th>提出</th>
              <th>本日のまとめ</th>
              <th>案件</th>
              <th>工数</th>
              <th>課題・相談</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const report = reportByMember.get(member.id);
              const projectNames = report
                ? [
                    ...new Set(
                      report.entries.map((entry) => projectName(entry.projectId, schedules)),
                    ),
                  ]
                : [];
              return (
                <Fragment key={member.id}>
                  <tr className={!report ? styles.missingRow : undefined}>
                    <td>
                      <div className={styles.memberCell}>
                        {canManage && !report ? (
                          <input
                            aria-label={`${member.name}をリマインド対象に選択`}
                            checked={selectedMemberIds.has(member.id)}
                            onChange={(event) => {
                              const next = new Set(selectedMemberIds);
                              if (event.target.checked) next.add(member.id);
                              else next.delete(member.id);
                              setSelectedMemberIds(next);
                            }}
                            type="checkbox"
                          />
                        ) : null}
                        <span>{member.initials}</span>
                        <div>
                          <strong>{member.name}</strong>
                          <small>{member.role}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          report?.status === "submitted"
                            ? styles.submitted
                            : report
                              ? styles.draft
                              : styles.notSubmitted
                        }
                      >
                        {report?.status === "submitted" ? "提出済み" : report ? "下書き" : "未提出"}
                      </span>
                    </td>
                    <td className={styles.summaryCell}>
                      {report?.summary || "報告はまだありません"}
                      {report?.unreadCommentCount ? (
                        <small className={styles.unread}>
                          {report.unreadCommentCount}件の未読コメント
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <div className={styles.projectList}>
                        {projectNames.length > 0
                          ? projectNames.map((name) => <span key={name}>{name}</span>)
                          : "-"}
                      </div>
                    </td>
                    <td className={styles.hoursCell}>{report ? `${sumHours(report)}h` : "-"}</td>
                    <td>
                      {report?.blockers?.trim() ? (
                        <span className={styles.blocker}>あり</span>
                      ) : (
                        <span className={styles.none}>なし</span>
                      )}
                    </td>
                    <td>
                      {report ? (
                        <div className={styles.rowActions}>
                          <button
                            aria-label={`${member.name}の日報へコメント`}
                            className={styles.openButton}
                            onClick={() => {
                              setCommentReportId(commentReportId === report.id ? null : report.id);
                              setQuickComment("");
                            }}
                            type="button"
                          >
                            <ChatBubbleLeftRightIcon />
                          </button>
                          <button
                            aria-label={`${member.name}の日報を開く`}
                            className={styles.openButton}
                            onClick={() => onOpenReport(report)}
                            type="button"
                          >
                            <ArrowRightIcon />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {report && commentReportId === report.id ? (
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
                                <span>{projectName(entry.projectId, schedules)}</span>
                                <p>{entry.summary}</p>
                                <b>{entry.hours}h</b>
                              </div>
                            ))}
                          </div>
                          <div className={styles.reviewComments}>
                            <strong>コメント {report.comments.length}件</strong>
                            {report.comments.map((item) => (
                              <article key={item.id}>
                                <header>
                                  <strong>{item.authorName}</strong>
                                  <time>{new Date(item.createdAt).toLocaleString("ja-JP")}</time>
                                </header>
                                <MarkdownPreview content={item.body} />
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
                              onChange={(event) => setQuickComment(event.target.value)}
                              placeholder="確認事項やフィードバックをMarkdownで入力"
                              value={quickComment}
                            />
                            <button
                              disabled={!quickComment.trim() || commenting}
                              onClick={submitComment}
                              type="button"
                            >
                              コメントを送信
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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

function projectName(projectId: string, schedules: ScheduleSnapshot[]) {
  return (
    schedules.find((schedule) => schedule.project.id === projectId)?.project.workspace ?? projectId
  );
}

function sumHours(report: DailyReport) {
  return report.entries.reduce((sum, entry) => sum + entry.hours, 0);
}

function formatLongDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}
