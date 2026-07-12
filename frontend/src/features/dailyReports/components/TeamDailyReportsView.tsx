import { useMemo, useState } from "react";

import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { DailyReport, Member } from "../../../types/schedule";
import { getTeamDailyReportDay, getTeamReportDateOptions } from "../model/dailyReports";
import { TeamDailyReportSummary } from "./TeamDailyReportSummary";
import { TeamDailyReportTable } from "./TeamDailyReportTable";
import { TeamDailyReportToolbar } from "./TeamDailyReportToolbar";

import * as styles from "./TeamDailyReportsView.css";

type TeamDailyReportsViewProps = {
  canManage: boolean;
  currentMemberId: string;
  members: Member[];
  onComment: (reportId: string, body: string) => Promise<void>;
  onOpenReport: (report: DailyReport) => void;
  onOpenOwnReport: (date: string) => void;
  onRemind: (date: string, memberIds: string[]) => Promise<void>;
  reports: DailyReport[];
  schedules: ScheduleSnapshot[];
  teamName: string;
  todayKey: string;
};

/** チーム日報の対象日、選択状態、レビュー操作を調停します。 */
export function TeamDailyReportsView({
  canManage,
  currentMemberId,
  members,
  onComment,
  onOpenReport,
  onOpenOwnReport,
  onRemind,
  reports,
  schedules,
  teamName,
  todayKey,
}: TeamDailyReportsViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [commentReportId, setCommentReportId] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const dateOptions = useMemo(
    () => getTeamReportDateOptions(todayKey, reports),
    [reports, todayKey],
  );
  const day = useMemo(
    () => getTeamDailyReportDay(reports, members, selectedDate, schedules),
    [members, reports, schedules, selectedDate],
  );
  const ownReport = day.reportByMember.get(currentMemberId);

  function moveDate(days: number) {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
    setSelectedMemberIds(new Set());
  }

  async function remindSelected() {
    if (selectedMemberIds.size > 0) {
      await onRemind(selectedDate, [...selectedMemberIds]);
      setSelectedMemberIds(new Set());
    }
  }

  async function submitComment() {
    if (!commentReportId || !quickComment.trim()) {
      return;
    }
    setCommenting(true);
    try {
      await onComment(commentReportId, quickComment.trim());
      setQuickComment("");
      setCommentReportId(null);
    } finally {
      setCommenting(false);
    }
  }

  return (
    <section className={styles.teamView} aria-label="みんなの日報">
      <TeamDailyReportToolbar
        canManage={canManage}
        dateOptions={dateOptions}
        missingMemberIds={day.missingMemberIds}
        onDateChange={setSelectedDate}
        onMoveDate={moveDate}
        onOpenOwnReport={onOpenOwnReport}
        onRemind={remindSelected}
        ownReport={ownReport}
        ownReportRequired={day.requiredMemberIds.has(currentMemberId)}
        requiredMemberCount={day.requiredMemberIds.size}
        selectedDate={selectedDate}
        selectedMemberCount={selectedMemberIds.size}
        teamName={teamName}
        todayKey={todayKey}
      />
      <TeamDailyReportSummary
        blockerCount={day.blockerCount}
        requiredMemberCount={day.requiredMemberIds.size}
        requiredSubmitted={day.requiredSubmitted}
        totalHours={day.totalHours}
      />
      <TeamDailyReportTable
        canManage={canManage}
        commentReportId={commentReportId}
        commenting={commenting}
        members={members}
        missingMemberIds={day.missingMemberIds}
        onCommentChange={setQuickComment}
        onCommentReportChange={(reportId) => {
          setCommentReportId(reportId);
          setQuickComment("");
        }}
        onOpenReport={onOpenReport}
        onSelectedMemberIdsChange={setSelectedMemberIds}
        onSubmitComment={submitComment}
        quickComment={quickComment}
        reportByMember={day.reportByMember}
        requiredMemberIds={day.requiredMemberIds}
        schedules={schedules}
        selectedMemberIds={selectedMemberIds}
      />
    </section>
  );
}
