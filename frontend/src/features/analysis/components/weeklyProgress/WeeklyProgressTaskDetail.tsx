import { formatShortDate, statusLabels } from "../../../../lib/schedule";
import type { ScheduleTask } from "../../../../types/schedule";
import {
  formatWeekLabel,
  maxWeeklyDetailTasks,
  type WeeklyProgressRow,
  type WeeklyTaskDetail,
} from "../../model/weeklyProgress";

type WeeklyProgressTaskDetailProps = {
  detail: WeeklyTaskDetail;
  onSelectTask: (taskId: string) => void;
  selectedWeek: WeeklyProgressRow;
};

/** 選択週に作業期間が重なるタスクを、担当者単位で表示します。 */
export function WeeklyProgressTaskDetail({
  detail,
  onSelectTask,
  selectedWeek,
}: WeeklyProgressTaskDetailProps) {
  return (
    <div className="weekly-progress-detail">
      <div className="weekly-progress-detail-heading">
        <div>
          <h3>{formatWeekLabel(selectedWeek.start)}の作業内容</h3>
          <p>
            {formatShortDate(selectedWeek.start)} - {formatShortDate(selectedWeek.end)} / 担当者別
          </p>
        </div>
        <strong>{detail.totalCount}件</strong>
      </div>
      <div className="weekly-progress-groups">
        {detail.groups.map((group) => (
          <section className="weekly-progress-group" key={group.memberId}>
            <div className="weekly-progress-group-heading">
              <strong>{group.member?.name ?? "未割当"}</strong>
              <span>{group.tasks.length}件表示</span>
            </div>
            <div className="weekly-progress-task-list">
              {group.tasks.map((task) => (
                <WeeklyProgressTask
                  key={`${group.memberId}-${task.id}`}
                  onSelectTask={onSelectTask}
                  task={task}
                />
              ))}
            </div>
          </section>
        ))}
        {detail.groups.length === 0 ? (
          <div className="weekly-progress-detail-empty">この週にかかるタスクはありません。</div>
        ) : null}
      </div>
      {detail.hiddenCount > 0 ? (
        <small className="weekly-progress-detail-note">
          タスクが多いため、先頭{maxWeeklyDetailTasks}件を表示しています。対象タスクは全
          {detail.totalCount}件です。
        </small>
      ) : null}
    </div>
  );
}

function WeeklyProgressTask({
  onSelectTask,
  task,
}: {
  onSelectTask: (taskId: string) => void;
  task: ScheduleTask;
}) {
  return (
    <button className="weekly-progress-task" onClick={() => onSelectTask(task.id)} type="button">
      <span className={`weekly-progress-task-status ${task.status}`}>
        {statusLabels[task.status]}
      </span>
      <span className="weekly-progress-task-copy">
        <strong>{task.title}</strong>
        <small>
          {formatShortDate(task.start)} - {formatShortDate(task.end)} / {task.progress}%
        </small>
      </span>
    </button>
  );
}
