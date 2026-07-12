import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

import type { DailyReport, Member } from "../../../types/schedule";
import { formatReportDate } from "../model/dailyReports";

import * as styles from "./DailyReportPage.css";

type DeleteDailyReportDialogProps = {
  members: Member[];
  onCancel: () => void;
  onConfirm: () => void;
  report: DailyReport;
};

/** 日報と連携実績を削除する前の確認ダイアログです。 */
export function DeleteDailyReportDialog({
  members,
  onCancel,
  onConfirm,
  report,
}: DeleteDailyReportDialogProps) {
  return (
    <div className={styles.dialogOverlay} role="presentation">
      <aside
        aria-label="日報の削除確認"
        aria-modal="true"
        className={styles.deleteDialog}
        role="dialog"
      >
        <header>
          <div>
            <strong>日報を削除しますか？</strong>
            <span>
              {formatReportDate(report.date)} /{" "}
              {members.find((member) => member.id === report.memberId)?.name}
            </span>
          </div>
          <button aria-label="閉じる" onClick={onCancel} type="button">
            <XMarkIcon />
          </button>
        </header>
        <section>
          <ExclamationTriangleIcon />
          <div>
            <strong>案件実績も同時に取り消されます</strong>
            <p>日報に紐づく作業時間とコメントは元に戻せません。</p>
          </div>
        </section>
        <footer>
          <button onClick={onCancel} type="button">
            キャンセル
          </button>
          <button className={styles.deleteConfirmButton} onClick={onConfirm} type="button">
            削除する
          </button>
        </footer>
      </aside>
    </div>
  );
}
