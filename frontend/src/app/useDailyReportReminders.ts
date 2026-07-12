import { useEffect, useState } from "react";

import { listDailyReportReminders } from "../data/dailyReportRepository";
import type { DailyReportReminder } from "../types/schedule";

/** 日報関連画面へ移動した時に、最新の提出リマインドを遅延取得します。 */
export function useDailyReportReminders(refreshKey: string) {
  const [reminders, setReminders] = useState<DailyReportReminder[]>([]);

  useEffect(() => {
    let active = true;
    listDailyReportReminders()
      .then((items) => {
        if (active) {
          setReminders(items);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return reminders;
}
