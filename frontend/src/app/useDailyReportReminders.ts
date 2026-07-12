import { useQuery } from "@tanstack/react-query";

import { dailyReportRemindersQueryOptions } from "../features/dailyReports/api/dailyReportQueries";

/** 日報関連画面へ移動した時に、最新の提出リマインドを遅延取得します。 */
export function useDailyReportReminders(refreshKey: string) {
  return useQuery(dailyReportRemindersQueryOptions(refreshKey)).data ?? [];
}
