import { queryOptions } from "@tanstack/react-query";

import { listDailyReportReminders, listDailyReports } from "../../../data/dailyReportRepository";

export const dailyReportQueryKeys = {
  all: ["daily-reports"] as const,
  list: ["daily-reports", "list"] as const,
  reminders: (refreshKey: string) => ["daily-reports", "reminders", refreshKey] as const,
};

export function dailyReportsQueryOptions() {
  return queryOptions({
    queryFn: () => listDailyReports(),
    queryKey: dailyReportQueryKeys.list,
  });
}

export function dailyReportRemindersQueryOptions(refreshKey: string) {
  return queryOptions({
    queryFn: listDailyReportReminders,
    queryKey: dailyReportQueryKeys.reminders(refreshKey),
    staleTime: 15_000,
  });
}
