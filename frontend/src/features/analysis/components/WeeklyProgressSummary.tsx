import type { Member, ProjectIssue, ScheduleTask } from "../../../types/schedule";
import { useWeeklyProgressSummary } from "../hooks/useWeeklyProgressSummary";
import { WeeklyProgressIssueList } from "./weeklyProgress/WeeklyProgressIssueList";
import { WeeklyProgressOverview } from "./weeklyProgress/WeeklyProgressOverview";
import { WeeklyProgressTaskDetail } from "./weeklyProgress/WeeklyProgressTaskDetail";
import { WeeklyProgressWeekTable } from "./weeklyProgress/WeeklyProgressWeekTable";

type WeeklyProgressSummaryProps = {
  issues: ProjectIssue[];
  members: Member[];
  onOpenIssues: () => void;
  onSelectTask: (taskId: string) => void;
  projectEnd: string;
  projectStart: string;
  tasks: ScheduleTask[];
  todayKey: string;
};

/** 週次進捗の各表示領域を、共通のView Modelで構成します。 */
export function WeeklyProgressSummary({
  issues,
  members,
  onOpenIssues,
  onSelectTask,
  projectEnd,
  projectStart,
  tasks,
  todayKey,
}: WeeklyProgressSummaryProps) {
  const model = useWeeklyProgressSummary({
    issues,
    members,
    projectEnd,
    projectStart,
    tasks,
    todayKey,
  });

  return (
    <section className="dashboard-panel weekly-progress-panel" aria-label="週次進捗サマリー">
      <WeeklyProgressOverview
        currentWeek={model.currentWeek}
        currentWeekIndex={model.currentWeekIndex}
        metrics={model.metrics}
        totalWeeks={model.rows.length}
      />
      <WeeklyProgressWeekTable
        activeWeekWindowStart={model.activeWeekWindowStart}
        maxWeekWindowStart={model.maxWeekWindowStart}
        onMoveToCurrentWeek={model.moveToCurrentWeek}
        onMoveWeekWindow={model.moveWeekWindow}
        onSelectWeek={model.selectWeek}
        selectedWeekKey={model.selectedWeek?.weekKey}
        totalWeeks={model.rows.length}
        visibleRows={model.visibleRows}
      />
      {model.selectedWeek ? (
        <>
          <WeeklyProgressTaskDetail
            detail={model.detail}
            onSelectTask={onSelectTask}
            selectedWeek={model.selectedWeek}
          />
          <WeeklyProgressIssueList
            issues={model.selectedWeekIssues}
            memberById={model.memberById}
            onOpenIssues={onOpenIssues}
            selectedWeek={model.selectedWeek}
            unresolvedCount={model.unresolvedIssueCount}
          />
        </>
      ) : null}
      <small className="weekly-progress-note">
        対象タスクは、その週に作業期間が重なるタスクの件数です。週別の完了率は、その週に終了予定のタスクのうち完了済みの割合です。
      </small>
    </section>
  );
}
