import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import type { AuthUser } from "../../../data/authRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport, Member } from "../../../types/schedule";
import { DailyReportEntries } from "./DailyReportEntries";
import { DailyReportMarkdownField } from "./DailyReportMarkdownField";
import { DailyReportSidebar } from "./DailyReportSidebar";
import { DeleteDailyReportDialog } from "./DeleteDailyReportDialog";

import * as styles from "./DailyReportPage.css";

type DailyReportEditorProps = {
  comment: string;
  currentUser: AuthUser;
  members: Member[];
  onAddComment: () => void;
  onChange: (report: DailyReport) => void;
  onCommentChange: (value: string) => void;
  onDelete: () => void;
  onSave: () => void;
  onSubmit: () => void;
  readOnly: boolean;
  report: DailyReport;
  schedules: ScheduleSnapshot[];
};

/** 日報の基本情報、Markdown本文、作業明細、コメントを構成します。 */
export function DailyReportEditor({
  comment,
  currentUser,
  members,
  onAddComment,
  onChange,
  onCommentChange,
  onDelete,
  onSave,
  onSubmit,
  readOnly,
  report,
  schedules,
}: DailyReportEditorProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const update = (patch: Partial<DailyReport>) => onChange({ ...report, ...patch });

  return (
    <article className={styles.editor}>
      <header className={styles.editorHeader}>
        <div className={styles.headerFields}>
          <input
            aria-label="日報日付"
            className={styles.dateInput}
            disabled={readOnly}
            onChange={(event) => update({ date: event.target.value })}
            type="date"
            value={report.date}
          />
          <select
            aria-label="日報作成者"
            className={styles.select}
            disabled={readOnly}
            onChange={(event) => update({ memberId: event.target.value })}
            value={report.memberId}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <span className={report.status === "submitted" ? styles.submitted : styles.draft}>
            {report.status === "submitted" ? "提出済み" : "下書き"}
          </span>
        </div>
        <div className={styles.editorActions}>
          <button
            aria-label="日報を削除"
            className={styles.iconButton}
            disabled={readOnly}
            onClick={() => setDeleteConfirmOpen(true)}
            type="button"
          >
            <TrashIcon />
          </button>
          <button
            className={styles.secondaryButton}
            disabled={readOnly}
            onClick={onSave}
            type="button"
          >
            下書き保存
          </button>
          <button
            className={styles.primaryButton}
            disabled={readOnly || !report.summary.trim() || report.entries.length === 0}
            onClick={onSubmit}
            type="button"
          >
            提出して実績反映
          </button>
        </div>
      </header>

      <div className={styles.editorBody}>
        <main className={styles.editorMain}>
          <DailyReportMarkdownField
            label="本日のまとめ"
            onChange={(summary) => update({ summary })}
            readOnly={readOnly}
            value={report.summary}
          />
          <DailyReportEntries
            entries={report.entries}
            onChange={(entries) => update({ entries })}
            readOnly={readOnly}
            schedules={schedules}
          />
          <div className={styles.twoColumns}>
            <DailyReportMarkdownField
              label="課題・相談事項"
              onChange={(blockers) => update({ blockers })}
              readOnly={readOnly}
              value={report.blockers ?? ""}
            />
            <DailyReportMarkdownField
              label="翌日の予定"
              onChange={(nextPlan) => update({ nextPlan })}
              readOnly={readOnly}
              value={report.nextPlan ?? ""}
            />
          </div>
        </main>
        <DailyReportSidebar
          comment={comment}
          currentUser={currentUser}
          onAddComment={onAddComment}
          onCommentChange={onCommentChange}
          report={report}
          schedules={schedules}
        />
      </div>
      {deleteConfirmOpen ? (
        <DeleteDailyReportDialog
          members={members}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            setDeleteConfirmOpen(false);
            onDelete();
          }}
          report={report}
        />
      ) : null}
    </article>
  );
}
