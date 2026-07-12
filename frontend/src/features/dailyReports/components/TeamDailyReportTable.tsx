import { ArrowRightIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";

import type { DailyReport, Member } from "../../../types/schedule";
import {
  getDailyReportProjectName,
  sumDailyReportHours,
  type DailyReportSchedule,
} from "../model/dailyReports";
import { TeamDailyReportReview } from "./TeamDailyReportReview";

import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportTableProps = {
  canManage: boolean;
  commentReportId: string | null;
  commenting: boolean;
  members: Member[];
  missingMemberIds: string[];
  onCommentChange: (value: string) => void;
  onCommentReportChange: (reportId: string | null) => void;
  onOpenReport: (report: DailyReport) => void;
  onSelectedMemberIdsChange: (memberIds: Set<string>) => void;
  onSubmitComment: () => void;
  quickComment: string;
  reportByMember: Map<string, DailyReport>;
  requiredMemberIds: Set<string>;
  schedules: DailyReportSchedule[];
  selectedMemberIds: Set<string>;
};

/** チーム全員の提出状況と、選択した日報のレビュー行を表示します。 */
export function TeamDailyReportTable({
  canManage,
  commentReportId,
  commenting,
  members,
  missingMemberIds,
  onCommentChange,
  onCommentReportChange,
  onOpenReport,
  onSelectedMemberIdsChange,
  onSubmitComment,
  quickComment,
  reportByMember,
  requiredMemberIds,
  schedules,
  selectedMemberIds,
}: TeamDailyReportTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              {canManage && missingMemberIds.length > 0 ? (
                <input
                  aria-label="未提出者をすべて選択"
                  checked={selectedMemberIds.size === missingMemberIds.length}
                  onChange={(event) =>
                    onSelectedMemberIdsChange(
                      event.target.checked ? new Set(missingMemberIds) : new Set(),
                    )
                  }
                  type="checkbox"
                />
              ) : null}
              メンバー
            </th>
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
            const reportRequired = requiredMemberIds.has(member.id);
            const projectNames = report
              ? [
                  ...new Set(
                    report.entries.map((entry) =>
                      getDailyReportProjectName(entry.projectId, schedules),
                    ),
                  ),
                ]
              : [];
            return (
              <Fragment key={member.id}>
                <tr className={!report && reportRequired ? styles.missingRow : undefined}>
                  <td>
                    <div className={styles.memberCell}>
                      {canManage && !report && reportRequired ? (
                        <input
                          aria-label={`${member.name}をリマインド対象に選択`}
                          checked={selectedMemberIds.has(member.id)}
                          onChange={(event) => {
                            const next = new Set(selectedMemberIds);
                            if (event.target.checked) {
                              next.add(member.id);
                            } else {
                              next.delete(member.id);
                            }
                            onSelectedMemberIdsChange(next);
                          }}
                          type="checkbox"
                        />
                      ) : null}
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
                            : reportRequired
                              ? styles.notSubmitted
                              : styles.notRequired
                      }
                    >
                      {report?.status === "submitted"
                        ? "提出済み"
                        : report
                          ? "下書き"
                          : reportRequired
                            ? "未提出"
                            : "提出不要"}
                    </span>
                  </td>
                  <td className={styles.summaryCell}>
                    {report?.summary ||
                      (reportRequired ? "報告はまだありません" : "非稼働日のため提出不要")}
                    {report?.unreadCommentCount ? (
                      <small className={styles.unread}>
                        {report.unreadCommentCount}件の未読コメント
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <div className={styles.projectList}>
                      {projectNames.length > 0
                        ? projectNames.map((name) => <span key={name}>{name}</span>)
                        : "-"}
                    </div>
                  </td>
                  <td className={styles.hoursCell}>
                    {report ? `${sumDailyReportHours(report.entries)}h` : "-"}
                  </td>
                  <td>
                    {report?.blockers?.trim() ? (
                      <span className={styles.blocker}>あり</span>
                    ) : (
                      <span className={styles.none}>なし</span>
                    )}
                  </td>
                  <td>
                    {report ? (
                      <div className={styles.rowActions}>
                        <button
                          aria-label={`${member.name}の日報へコメント`}
                          className={styles.openButton}
                          onClick={() =>
                            onCommentReportChange(commentReportId === report.id ? null : report.id)
                          }
                          type="button"
                        >
                          <ChatBubbleLeftRightIcon />
                        </button>
                        <button
                          aria-label={`${member.name}の日報を開く`}
                          className={styles.openButton}
                          onClick={() => onOpenReport(report)}
                          type="button"
                        >
                          <ArrowRightIcon />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
                {report && commentReportId === report.id ? (
                  <TeamDailyReportReview
                    commenting={commenting}
                    member={member}
                    onCommentChange={onCommentChange}
                    onSubmitComment={onSubmitComment}
                    quickComment={quickComment}
                    report={report}
                    schedules={schedules}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
