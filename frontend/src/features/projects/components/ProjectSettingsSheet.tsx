import { projectLifecycleLabels } from "../../../lib/projects";
import type { Member, Project, Team } from "../../../types/schedule";
import { useProjectSettingsEditor } from "../hooks/useProjectSettingsEditor";
import { ProjectArchiveSettings } from "./settings/ProjectArchiveSettings";
import { ProjectBasicSettings } from "./settings/ProjectBasicSettings";
import { ProjectMemberSettings } from "./settings/ProjectMemberSettings";

type ProjectSettingsPageProps = {
  activeProjectCount: number;
  members: Member[];
  onArchiveProject: (projectId: string) => void;
  onSaveProject: (project: Project) => void;
  project: Project;
  team?: Team;
  teams: Team[];
};

/** 案件基本情報、要員権限、整理操作を共通draftで構成します。 */
export function ProjectSettingsPage(props: ProjectSettingsPageProps) {
  const editor = useProjectSettingsEditor(props);
  const { draft } = editor;
  return (
    <section className="project-settings-page" aria-label="プロジェクト設定">
      <div className="master-settings-page-header">
        <div>
          <span>{props.team?.name ?? "未所属"}</span>
          <h2>プロジェクト設定</h2>
        </div>
        <strong>{props.project.workspace}</strong>
      </div>
      <div className="master-settings-summary project-settings-summary">
        <Summary label="プロジェクトNo." value={draft.projectNo || "未設定"} />
        <Summary
          label="ステータス"
          value={projectLifecycleLabels[draft.lifecycleStatus ?? "planning"]}
        />
        <Summary label="プロジェクト要員" value={`${editor.activeMemberCount}名`} />
        <Summary
          label="期間"
          value={`${formatShortDate(draft.rangeStart)} - ${formatShortDate(draft.rangeEnd)}`}
        />
      </div>
      <div className="project-settings-content">
        <ProjectBasicSettings
          draft={draft}
          onChange={editor.updateDraft}
          onTeamChange={editor.changeTeam}
          teams={props.teams}
        />
        <ProjectMemberSettings
          activeMemberCount={editor.activeMemberCount}
          draft={draft}
          members={editor.assignableMembers}
          onRoleChange={editor.changeMemberRole}
          onToggleMember={editor.toggleMember}
        />
        <div className="settings-warning-stack">
          {editor.invalidRange ? (
            <p className="settings-warning">終了日は開始日以降にしてください。</p>
          ) : null}
          {!editor.invalidRange && editor.milestoneOutside ? (
            <p className="settings-warning muted">次のマイルストーンがプロジェクト期間外です。</p>
          ) : null}
        </div>
        <ProjectArchiveSettings
          disabled={props.activeProjectCount <= 1}
          onArchive={props.onArchiveProject}
          project={props.project}
        />
        <div className="settings-actions">
          <button
            className="primary-button"
            disabled={editor.invalidRange}
            onClick={editor.save}
            type="button"
          >
            保存
          </button>
        </div>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatShortDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}
