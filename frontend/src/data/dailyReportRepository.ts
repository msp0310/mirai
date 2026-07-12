import type { DailyReport, DailyReportReminder } from "../types/schedule";
import { requestJson } from "./apiClient";
export function listDailyReports(teamId?: string, page = 1, pageSize = 100) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (teamId) {
    query.set("teamId", teamId);
  }
  return requestJson<DailyReport[]>(`/daily-reports?${query}`);
}

export function addDailyReportComment(reportId: string, body: string) {
  return requestJson<DailyReport>(`/daily-reports/${reportId}/comments`, {
    body: JSON.stringify({ body }),
    method: "POST",
  });
}

export function markDailyReportRead(reportId: string) {
  return requestJson<void>(`/daily-reports/${reportId}/read`, {
    method: "POST",
  });
}

export function listDailyReportReminders() {
  return requestJson<DailyReportReminder[]>("/daily-reports/reminders", {});
}

export function sendDailyReportReminders(teamId: string, date: string, memberIds: string[]) {
  return requestJson<DailyReportReminder[]>("/daily-reports/reminders", {
    body: JSON.stringify({ date, memberIds, teamId }),
    method: "POST",
  });
}

export function markDailyReportReminderRead(reminderId: string) {
  return requestJson<void>(`/daily-reports/reminders/${reminderId}/read`, {
    method: "POST",
  });
}

export function saveDailyReport(report: DailyReport) {
  return requestJson<DailyReport>(`/daily-reports/${report.id}`, {
    body: JSON.stringify({
      blockers: report.blockers,
      comments: report.comments,
      date: report.date,
      entries: report.entries,
      memberId: report.memberId,
      nextPlan: report.nextPlan,
      status: report.status,
      summary: report.summary,
      version: report.version,
    }),
    method: "PUT",
  });
}

export function deleteDailyReport(reportId: string) {
  return requestJson<void>(`/daily-reports/${reportId}`, {
    method: "DELETE",
  });
}
