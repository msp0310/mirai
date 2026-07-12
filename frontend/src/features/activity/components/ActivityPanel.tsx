import type { ConfigChangeReview, TaskChangeReview } from "../../../lib/changeReview";
import type { ActivityLogEntry, Project, TaskInspectorFocusTarget } from "../../../types/schedule";
import { ActivityTimeline } from "./ActivityTimeline";
import { ChangeReviewPanel } from "./ChangeReviewPanel";

type ActivityPanelProps = {
  changeReview: TaskChangeReview;
  configReview: ConfigChangeReview;
  entries: ActivityLogEntry[];
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  project: Project;
};

/** 保存前差分と保存済み履歴を一つの時系列画面として構成します。 */
export function ActivityPanel(props: ActivityPanelProps) {
  return (
    <section className="activity-panel" aria-label="変更履歴">
      <ActivityTimeline
        entries={props.entries}
        onSelectTask={(taskId, projectId) => props.onSelectTask(taskId, undefined, projectId)}
        project={props.project}
        review={
          <ChangeReviewPanel
            configReview={props.configReview}
            hasUnsavedChanges={props.hasUnsavedChanges}
            onSaveDraft={props.onSaveDraft}
            onSelectTask={props.onSelectTask}
            review={props.changeReview}
          />
        }
      />
    </section>
  );
}
