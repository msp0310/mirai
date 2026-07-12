import { PlusIcon } from "@heroicons/react/24/outline";

import type { AuthUser } from "../../../data/authRepository";
import type {
  Attachment,
  Member,
  Project,
  ProjectIssue,
  ScheduleTask,
} from "../../../types/schedule";
import { useProjectIssueController } from "../hooks/useProjectIssueController";
import { IssueDetailPage } from "./IssueDetailPage";
import { IssueEditorDialog } from "./IssueEditorDialog";
import { IssueListView } from "./IssueListView";

type ProjectIssuePanelProps = {
  attachments: Attachment[];
  issues: ProjectIssue[];
  members: Member[];
  currentUser: AuthUser;
  onCreateIssue: (issue: Partial<ProjectIssue>) => string;
  onSelectTask: (taskId: string) => void;
  onUpdateIssue: (issueId: string, patch: Partial<ProjectIssue>) => void;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  project: Project;
  tasks: ScheduleTask[];
};

/** 課題一覧、詳細、編集ダイアログのページ遷移を構成します。 */
export function ProjectIssuePanel({
  attachments,
  issues,
  members,
  currentUser,
  onCreateIssue,
  onSelectTask,
  onUpdateIssue,
  onAttachmentAdded,
  onAttachmentDeleted,
  project,
  tasks,
}: ProjectIssuePanelProps) {
  const controller = useProjectIssueController({
    currentUser,
    issues,
    members,
    onCreateIssue,
    onUpdateIssue,
    tasks,
  });
  const { detailIssue } = controller;

  return (
    <section className="issue-panel" aria-label="課題管理">
      <div className="issue-header">
        <div>
          <span>{project.workspace}</span>
          <h2>課題管理</h2>
        </div>
        <button className="issue-add-button" onClick={controller.openCreateDialog} type="button">
          <PlusIcon />
          課題追加
        </button>
      </div>

      {detailIssue ? (
        <IssueDetailPage
          attachments={attachments}
          issue={detailIssue}
          memberById={controller.memberById}
          onAddReply={(body) => controller.addIssueReply(detailIssue.id, body)}
          onAttachmentAdded={onAttachmentAdded}
          onAttachmentDeleted={onAttachmentDeleted}
          onBack={controller.closeDetail}
          onEdit={() => controller.openEditDialog(detailIssue)}
          onSelectTask={onSelectTask}
          projectId={project.id}
          taskById={controller.taskById}
        />
      ) : (
        <IssueListView
          issues={controller.filteredIssues}
          memberById={controller.memberById}
          onEdit={controller.openEditDialog}
          onOpenDetail={controller.openDetail}
          onQueryChange={controller.setQuery}
          onSelectTask={onSelectTask}
          onStatusFilterChange={controller.setStatusFilter}
          query={controller.query}
          stats={controller.stats}
          statusFilter={controller.statusFilter}
          taskById={controller.taskById}
        />
      )}

      {controller.dialog ? (
        <IssueEditorDialog
          dialog={controller.dialog}
          members={members}
          onClose={controller.closeDialog}
          onSave={controller.saveDialogIssue}
          onSelectTask={onSelectTask}
          onUpdateIssue={controller.updateDialogIssue}
          taskById={controller.taskById}
          tasks={tasks}
        />
      ) : null}
    </section>
  );
}
