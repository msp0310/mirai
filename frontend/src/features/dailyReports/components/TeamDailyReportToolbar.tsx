import {
  BellAlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import type { DailyReport } from "../../../types/schedule";
import { formatLongReportDate } from "../model/dailyReports";

import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportToolbarProps = {
  canManage: boolean;
  dateOptions: string[];
  missingMemberIds: string[];
  onDateChange: (date: string) => void;
  onMoveDate: (days: number) => void;
  onOpenOwnReport: (date: string) => void;
  onRemind: () => Promise<void>;
  ownReport?: DailyReport;
  ownReportRequired: boolean;
  requiredMemberCount: number;
  selectedDate: string;
  selectedMemberCount: number;
  teamName: string;
  todayKey: string;
};

/** 対象日移動、自分の日報、未提出者リマインドを表示します。 */
export function TeamDailyReportToolbar({
  canManage,
  dateOptions,
  missingMemberIds,
  onDateChange,
  onMoveDate,
  onOpenOwnReport,
  onRemind,
  ownReport,
  ownReportRequired,
  requiredMemberCount,
  selectedDate,
  selectedMemberCount,
  teamName,
  todayKey,
}: TeamDailyReportToolbarProps) {
  const [sending, setSending] = useState(false);

  async function remind() {
    setSending(true);
    try {
      await onRemind();
    } finally {
      setSending(false);
    }
  }

  return (
    <header className={styles.toolbar}>
      <div>
        <strong>{formatLongReportDate(selectedDate)}</strong>
        <span>{teamName}の作業内容と提出状況</span>
        {requiredMemberCount === 0 ? (
          <em className={styles.nonWorkingNotice}>非稼働日のため提出は任意です</em>
        ) : null}
      </div>
      <div className={styles.toolbarActions}>
        <button
          className={styles.ownReportButton}
          disabled={!ownReport && selectedDate > todayKey}
          onClick={() => onOpenOwnReport(selectedDate)}
          title={!ownReport && selectedDate > todayKey ? "未来の日報は作成できません" : undefined}
          type="button"
        >
          {ownReport ? <PencilSquareIcon /> : <PlusIcon />}
          {ownReport
            ? ownReport.status === "submitted"
              ? "自分の日報を確認"
              : "自分の日報を編集"
            : ownReportRequired
              ? "自分の日報を提出"
              : "任意で日報を作成"}
        </button>
        {canManage && missingMemberIds.length > 0 ? (
          <button
            className={styles.remindButton}
            disabled={selectedMemberCount === 0 || sending}
            onClick={remind}
            type="button"
          >
            <BellAlertIcon />
            {selectedMemberCount > 0 ? `${selectedMemberCount}名へリマインド` : "未提出者を選択"}
          </button>
        ) : null}
        <div className={styles.dateNavigation} aria-label="日付移動">
          <button aria-label="前日" onClick={() => onMoveDate(-1)} type="button">
            <ChevronLeftIcon />
          </button>
          <button onClick={() => onDateChange(todayKey)} type="button">
            今日
          </button>
          <button aria-label="翌日" onClick={() => onMoveDate(1)} type="button">
            <ChevronRightIcon />
          </button>
        </div>
        <label className={styles.datePicker}>
          <span>対象日</span>
          <select value={selectedDate} onChange={(event) => onDateChange(event.target.value)}>
            {!dateOptions.includes(selectedDate) ? (
              <option value={selectedDate}>{formatLongReportDate(selectedDate)}</option>
            ) : null}
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {formatLongReportDate(date)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
