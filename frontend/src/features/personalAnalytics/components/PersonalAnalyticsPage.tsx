import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser } from "../../../data/authRepository";
import { listDailyReports } from "../../../data/dailyReportRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport, WorkLogCategory } from "../../../types/schedule";
import * as styles from "./PersonalAnalyticsPage.css";

type PersonalAnalyticsPageProps = {
  currentUser: AuthUser;
  schedules: ScheduleSnapshot[];
  todayKey: string;
};

const categoryLabels: Record<WorkLogCategory, string> = {
  improvement: "改善",
  incident: "障害",
  maintenance: "保守",
  meeting: "会議",
  other: "その他",
  support: "問い合わせ",
};

type PersonalLog = {
  category: WorkLogCategory;
  date: string;
  hours: number;
  id: string;
  projectId: string;
  summary: string;
  taskId?: string;
};

/** 案件横断の作業実績から、メンバーの年次・累計活動を振り返ります。 */
export function PersonalAnalyticsPage({
  currentUser,
  schedules,
  todayKey,
}: PersonalAnalyticsPageProps) {
  const members = useMemo(
    () => [
      ...new Map(
        schedules.flatMap((schedule) => schedule.members).map((member) => [member.id, member]),
      ).values(),
    ],
    [schedules],
  );
  const currentMember =
    members.find((item) => item.id === currentUser.memberId) ??
    members.find((item) => item.name === currentUser.name);
  const canViewOthers =
    ["admin", "manager"].includes(currentUser.role.toLowerCase()) ||
    ["PM", "PL"].includes(currentMember?.role.toUpperCase() ?? "");
  const [selectedMemberId, setSelectedMemberId] = useState(currentMember?.id ?? "");
  const selectedMember =
    members.find((item) => item.id === selectedMemberId) ?? currentMember ?? members[0];
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  useEffect(() => {
    listDailyReports()
      .then(setDailyReports)
      .catch(() => setDailyReports([]));
  }, []);
  useEffect(() => {
    if (!selectedMemberId && currentMember?.id) setSelectedMemberId(currentMember.id);
  }, [currentMember?.id, selectedMemberId]);
  const allLogs = useMemo(() => {
    const logs = new Map<string, PersonalLog>();
    schedules.forEach((schedule) =>
      (schedule.workLogs ?? [])
        .filter((log) => log.memberId === selectedMember?.id)
        .forEach((log) =>
          logs.set(log.id, {
            category: log.category,
            date: log.date,
            hours: log.hours,
            id: log.id,
            projectId: schedule.project.id,
            summary: log.summary,
            taskId: log.taskId,
          }),
        ),
    );
    dailyReports
      .filter((report) => report.memberId === selectedMember?.id)
      .forEach((report) =>
        report.entries.forEach((entry) =>
          logs.set(entry.workLogId ?? `${report.id}-${entry.id}`, {
            category: entry.category,
            date: report.date,
            hours: entry.hours,
            id: entry.workLogId ?? `${report.id}-${entry.id}`,
            projectId: entry.projectId,
            summary: entry.summary,
            taskId: entry.taskId,
          }),
        ),
      );
    return [...logs.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyReports, schedules, selectedMember?.id]);
  const currentYear = todayKey.slice(0, 4);
  const yearOptions = useMemo(
    () =>
      [...new Set([currentYear, ...allLogs.map((log) => log.date.slice(0, 4))])].sort().reverse(),
    [allLogs, currentYear],
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const yearLogs = allLogs.filter((log) => log.date.startsWith(selectedYear));
  const yearHours = sumHours(yearLogs);
  const yearProjectIds = new Set(yearLogs.map((log) => log.projectId));
  const yearTaskIds = new Set(yearLogs.flatMap((log) => (log.taskId ? [log.taskId] : [])));
  const yearDays = new Set(yearLogs.map((log) => log.date)).size;
  const categoryRows = Object.entries(categoryLabels)
    .map(([category, label]) => ({
      hours: sumHours(yearLogs.filter((log) => log.category === category)),
      label,
    }))
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const monthlyRows = Array.from({ length: 12 }, (_, index) => {
    const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
    return { hours: sumHours(yearLogs.filter((log) => log.date.startsWith(month))), month };
  });
  const maxMonthlyHours = Math.max(...monthlyRows.map((row) => row.hours), 1);
  const projectRows = buildProjectRows(allLogs, schedules);

  return (
    <section className={styles.page} aria-label="マイ分析">
      <header className={styles.header}>
        <div>
          <span>{selectedMember?.name ?? currentUser.name}</span>
          <h2>マイ分析</h2>
          <p>日々の作業実績から、年間の活動とこれまでの案件経験を振り返ります。</p>
        </div>
        <div className={styles.pickers}>
          {canViewOthers ? (
            <label className={styles.picker}>
              <span>対象メンバー</span>
              <select
                value={selectedMember?.id ?? ""}
                onChange={(event) => setSelectedMemberId(event.target.value)}
              >
                {members.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.picker}>
            <span>対象年</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className={styles.metrics}>
        <Metric icon={<ClockIcon />} label="作業時間" value={`${yearHours}h`} />
        <Metric icon={<FolderOpenIcon />} label="関わった案件" value={`${yearProjectIds.size}件`} />
        <Metric icon={<CheckCircleIcon />} label="対応タスク" value={`${yearTaskIds.size}件`} />
        <Metric icon={<CalendarDaysIcon />} label="活動日数" value={`${yearDays}日`} />
      </div>

      <div className={styles.chartGrid}>
        <section className={styles.panel}>
          <header>
            <strong>月別の作業推移</strong>
            <span>{selectedYear}年 / 12か月</span>
          </header>
          <div className={styles.monthlyChart}>
            {monthlyRows.map((row) => (
              <div key={row.month}>
                <span>{row.hours}h</span>
                <div>
                  <i style={{ height: `${Math.max((row.hours / maxMonthlyHours) * 100, 3)}%` }} />
                </div>
                <small>{formatShortMonth(row.month)}</small>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.panel}>
          <header>
            <strong>作業分類</strong>
            <span>{selectedYear}年</span>
          </header>
          <div className={styles.categoryList}>
            {categoryRows.length > 0 ? (
              categoryRows.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <div>
                    <i style={{ width: `${(row.hours / Math.max(yearHours, 1)) * 100}%` }} />
                  </div>
                  <b>{row.hours}h</b>
                </div>
              ))
            ) : (
              <p>この年の実績はまだありません。</p>
            )}
          </div>
        </section>
      </div>

      <section className={styles.activityPanel}>
        <header>
          <strong>{selectedYear}年にやったこと</strong>
          <span>{yearLogs.length}件の記録</span>
        </header>
        <div className={styles.activityList}>
          {yearLogs.length > 0 ? (
            yearLogs.map((log) => (
              <article key={log.id}>
                <time>{formatDate(log.date)}</time>
                <div>
                  <strong>{log.summary}</strong>
                  <span>
                    {projectName(log.projectId, schedules)}
                    {log.taskId ? ` / ${taskName(log.taskId, schedules)}` : ""}
                  </span>
                </div>
                <small>{categoryLabels[log.category]}</small>
                <b>{log.hours}h</b>
              </article>
            ))
          ) : (
            <p>この年の作業記録はありません。</p>
          )}
        </div>
      </section>

      <section className={styles.historyPanel}>
        <header>
          <strong>これまでのプロジェクト実績</strong>
          <span>累計 {sumHours(allLogs)}h</span>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>プロジェクト</th>
                <th>期間</th>
                <th>作業時間</th>
                <th>対応タスク</th>
                <th>完了</th>
                <th>主な作業</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map((row) => (
                <tr key={row.projectId}>
                  <td>
                    <strong>{row.projectName}</strong>
                  </td>
                  <td>
                    {formatDate(row.firstDate)} - {formatDate(row.lastDate)}
                  </td>
                  <td>
                    <b>{row.hours}h</b>
                  </td>
                  <td>{row.taskCount}件</td>
                  <td>{row.completedTaskCount}件</td>
                  <td>{row.categories.join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function buildProjectRows(logs: PersonalLog[], schedules: ScheduleSnapshot[]) {
  const grouped = new Map<string, PersonalLog[]>();
  logs.forEach((log) => {
    grouped.set(log.projectId, [...(grouped.get(log.projectId) ?? []), log]);
  });
  return [...grouped.entries()]
    .map(([projectId, items]) => {
      const taskIds = new Set(items.flatMap((item) => (item.taskId ? [item.taskId] : [])));
      const completedTaskCount = [...taskIds].filter((taskId) =>
        schedules.some((schedule) =>
          schedule.tasks.some((task) => task.id === taskId && task.status === "done"),
        ),
      ).length;
      return {
        categories: [...new Set(items.map((item) => categoryLabels[item.category]))],
        completedTaskCount,
        firstDate: items.at(-1)?.date ?? "",
        hours: sumHours(items),
        lastDate: items[0]?.date ?? "",
        projectId,
        projectName: projectName(projectId, schedules),
        taskCount: taskIds.size,
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function projectName(id: string, schedules: ScheduleSnapshot[]) {
  return schedules.find((item) => item.project.id === id)?.project.workspace ?? id;
}
function taskName(id: string, schedules: ScheduleSnapshot[]) {
  return schedules.flatMap((item) => item.tasks).find((task) => task.id === id)?.title ?? id;
}
function sumHours(logs: PersonalLog[]) {
  return Math.round(logs.reduce((sum, log) => sum + log.hours, 0) * 100) / 100;
}
function formatShortMonth(month: string) {
  return `${Number(month.slice(5))}月`;
}
function formatDate(date: string) {
  return date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "-";
}
