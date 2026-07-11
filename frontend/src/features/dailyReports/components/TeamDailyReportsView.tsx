import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport, Member } from "../../../types/schedule";
import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportsViewProps = {
  members: Member[];
  onOpenReport: (report: DailyReport) => void;
  reports: DailyReport[];
  schedules: ScheduleSnapshot[];
  teamName: string;
  todayKey: string;
};

/** チーム全員の日報提出状況と案件別実績を日付単位で確認します。 */
export function TeamDailyReportsView({
  members,
  onOpenReport,
  reports,
  schedules,
  teamName,
  todayKey,
}: TeamDailyReportsViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const dateOptions = useMemo(
    () => [...new Set([todayKey, ...reports.map((report) => report.date)])].sort().reverse(),
    [reports, todayKey],
  );
  const reportsForDate = reports.filter((report) => report.date === selectedDate);
  const reportByMember = new Map(reportsForDate.map((report) => [report.memberId, report]));
  const submitted = reportsForDate.filter((report) => report.status === "submitted").length;
  const totalHours = reportsForDate.reduce((sum, report) => sum + sumHours(report), 0);
  const blockerCount = reportsForDate.filter((report) => report.blockers?.trim()).length;

  return (
    <section className={styles.teamView} aria-label="みんなの日報">
      <header className={styles.toolbar}>
        <div>
          <strong>{formatLongDate(selectedDate)}</strong>
          <span>{teamName}の作業内容と提出状況</span>
        </div>
        <label className={styles.datePicker}>
          <span>対象日</span>
          <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {formatLongDate(date)}
              </option>
            ))}
          </select>
        </label>
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
              <th>メンバー</th>
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
                ? [...new Set(report.entries.map((entry) => projectName(entry.projectId, schedules)))]
                : [];
              return (
                <tr key={member.id} className={!report ? styles.missingRow : undefined}>
                  <td>
                    <div className={styles.memberCell}>
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
                  <td className={styles.summaryCell}>{report?.summary || "報告はまだありません"}</td>
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
                      <button
                        aria-label={`${member.name}の日報を開く`}
                        className={styles.openButton}
                        onClick={() => onOpenReport(report)}
                        type="button"
                      >
                        <ArrowRightIcon />
                      </button>
                    ) : null}
                  </td>
                </tr>
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
  return schedules.find((schedule) => schedule.project.id === projectId)?.project.workspace ?? projectId;
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
