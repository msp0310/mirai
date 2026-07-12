import type { AuthUser } from "../../../data/authRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { Team } from "../../../types/schedule";
import { useDailyReportsController } from "../hooks/useDailyReportsController";
import { DailyReportEditor } from "./DailyReportEditor";
import { DailyReportList } from "./DailyReportList";
import { DailyReportPageHeader } from "./DailyReportPageHeader";
import { TeamDailyReportsView } from "./TeamDailyReportsView";

import * as styles from "./DailyReportPage.css";

type DailyReportPageProps = {
  currentUser: AuthUser;
  schedules: ScheduleSnapshot[];
  team: Team;
  todayKey: string;
};

/** 自分の日報とチーム日報の表示を調停するページです。 */
export function DailyReportPage({ currentUser, schedules, team, todayKey }: DailyReportPageProps) {
  const controller = useDailyReportsController({ currentUser, schedules, team, todayKey });

  return (
    <section className={styles.page} aria-label="日報">
      <DailyReportPageHeader
        onCreate={() => controller.openOwnReport()}
        onViewModeChange={controller.setViewMode}
        viewMode={controller.viewMode}
      />
      {controller.viewMode === "team" ? (
        <TeamDailyReportsView
          canManage={controller.canManageTeam}
          currentMemberId={controller.currentMember?.id ?? currentUser.memberId}
          members={controller.teamMembers}
          onComment={(reportId, body) => controller.addComment(reportId, body)}
          onOpenReport={controller.openTeamReport}
          onOpenOwnReport={controller.openOwnReport}
          onRemind={controller.remind}
          reports={controller.teamReports}
          schedules={schedules}
          teamName={team.name}
          todayKey={todayKey}
        />
      ) : (
        <div className={styles.layout}>
          <DailyReportList
            message={controller.message}
            onSelect={controller.selectReport}
            reports={controller.visibleReports}
            selectedId={controller.selectedId}
          />
          {controller.draft ? (
            <DailyReportEditor
              comment={controller.comment}
              currentUser={currentUser}
              members={controller.members}
              onAddComment={() => controller.addComment()}
              onChange={controller.setDraft}
              onCommentChange={controller.setComment}
              onDelete={controller.removeReport}
              onSave={() => controller.persist("draft")}
              onSubmit={() => controller.persist("submitted")}
              readOnly={
                controller.draft.memberId !== controller.currentMember?.id &&
                !controller.canManageTeam
              }
              report={controller.draft}
              schedules={schedules}
            />
          ) : (
            <div className={styles.welcome}>
              <strong>日報を選択または作成してください</strong>
              <span>入力した作業時間は案件実績へ自動反映されます。</span>
            </div>
          )}
        </div>
      )}
      {controller.message && controller.reports.length > 0 ? (
        <div className={styles.message}>{controller.message}</div>
      ) : null}
    </section>
  );
}
