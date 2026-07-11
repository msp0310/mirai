import type { DailyReport } from "../types/schedule";
import { requestJson } from "./apiClient";
import { authRepository } from "./authRepository";

function authenticatedHeaders() {
  const token = authRepository.getAccessToken();
  if (!token) throw new Error("ログインが必要です。");
  return { Authorization: `Bearer ${token}` };
}

export function listDailyReports() {
  return requestJson<DailyReport[]>("/daily-reports", { headers: authenticatedHeaders() });
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
    headers: authenticatedHeaders(),
    method: "PUT",
  });
}

export function deleteDailyReport(reportId: string) {
  return requestJson<void>(`/daily-reports/${reportId}`, {
    headers: authenticatedHeaders(),
    method: "DELETE",
  });
}
