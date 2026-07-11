import type {
  Member,
  Project,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../../../types/schedule";
import { WeeklyProgressSummary } from "./WeeklyProgressSummary";

type WeeklyReportPanelProps = {
  members: Member[];
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  project: Project;
  tasks: ScheduleTask[];
  todayKey: string;
};

/** 定例会で確認する週次の作業予定と、プロジェクト全体の到達状況を表示します。 */
export function WeeklyReportPanel({
  members,
  onSelectTask,
  project,
  tasks,
  todayKey,
}: WeeklyReportPanelProps) {
  return (
    <section className="weekly-report-page" aria-label="週次報告">
      <header className="weekly-report-header">
        <div>
          <span>{project.workspace}</span>
          <h2>週次報告</h2>
          <p>その週に誰が何をするかと、計画に対するプロジェクト全体の到達状況を確認します。</p>
        </div>
        <div className="weekly-report-header-meta">
          <strong>{project.rangeStart} - {project.rangeEnd}</strong>
          <span>定例会向け</span>
        </div>
      </header>

      <WeeklyProgressSummary
        members={members}
        onSelectTask={onSelectTask}
        projectEnd={project.rangeEnd}
        projectStart={project.rangeStart}
        tasks={tasks}
        todayKey={todayKey}
      />
    </section>
  );
}
